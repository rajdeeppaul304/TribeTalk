import { beforeEach, describe, expect, it, vi } from "vitest";

const redis = { get: vi.fn(), set: vi.fn(), del: vi.fn(), incr: vi.fn(), expire: vi.fn() };
const state = { ready: true, enabled: true, nodeEnv: "test", loadTest: false };
const metric = { cacheHit: vi.fn(), cacheMiss: vi.fn(), cacheWrite: vi.fn() };
vi.mock("../src/config/redis.js", () => ({ getRedisClient: () => state.ready ? redis : null, isRedisReady: () => state.ready }));
vi.mock("../src/config/metrics.js", () => ({ metrics: metric }));
vi.mock("../src/config/logger.js", () => ({ logger: { warn: vi.fn() } }));
vi.mock("../src/config/env.js", () => ({ env: new Proxy({}, { get: (_target, key) => key === "CACHE_ENABLED" ? state.enabled : key === "NODE_ENV" ? state.nodeEnv : key === "LOAD_TEST_MODE" ? state.loadTest : undefined }) }));

const { cacheKeys, getCached, setCached, deleteCached } = await import("../src/Service/Cache.service.js");
const { assertMessageNotSpam } = await import("../src/Service/Spam.service.js");

beforeEach(() => {
  vi.clearAllMocks();
  state.ready = true; state.enabled = true; state.nodeEnv = "test"; state.loadTest = false;
  redis.get.mockResolvedValue(null); redis.set.mockResolvedValue("OK"); redis.del.mockResolvedValue(1); redis.incr.mockResolvedValue(1); redis.expire.mockResolvedValue(1);
});

describe("Redis cache service", () => {
  it("builds stable namespaced keys", () => {
    expect(cacheKeys.servers("u1")).toBe("cache:servers:u1");
    expect(cacheKeys.server("s1", "u1")).toBe("cache:server:s1:u1");
    expect(cacheKeys.search("u1", "a b")).toContain("cache:search:u1:");
  });
  it("reads, writes, and invalidates values", async () => {
    redis.get.mockResolvedValue(JSON.stringify({ ok: true }));
    await expect(getCached("cache:profile:u1")).resolves.toEqual({ ok: true });
    await expect(setCached("cache:profile:u1", { ok: true }, 15)).resolves.toBe(true);
    expect(redis.set).toHaveBeenCalledWith("cache:profile:u1", JSON.stringify({ ok: true }), { EX: 15 });
    await expect(deleteCached("cache:profile:u1")).resolves.toBe(true);
    expect(metric.cacheHit).toHaveBeenCalledWith("profile");
  });
  it("degrades safely when disabled, unavailable, malformed, or empty", async () => {
    state.enabled = false;
    await expect(getCached("cache:profile:u1")).resolves.toBeNull();
    await expect(setCached("cache:profile:u1", {})).resolves.toBe(false);
    state.enabled = true; state.ready = false;
    await expect(getCached("cache:profile:u1")).resolves.toBeNull();
    redis.get.mockRejectedValue(new Error("bad json"));
    await expect(getCached("cache:profile:u1")).resolves.toBeNull();
    redis.set.mockRejectedValue(new Error("write failed"));
    state.ready = true;
    await expect(setCached("cache:profile:u1", {})).resolves.toBe(false);
    await expect(deleteCached()).resolves.toBe(false);
  });
});

describe("message spam guard", () => {
  it("allows load-test bypass and Redis-backed messages", async () => {
    state.nodeEnv = "development"; state.loadTest = true;
    await expect(assertMessageNotSpam({ userId: "u", channelId: "c", content: "x" })).resolves.toBe(true);
    state.loadTest = false;
    await expect(assertMessageNotSpam({ userId: "u", channelId: "c", content: "x" })).resolves.toBe(true);
    expect(redis.incr).toHaveBeenCalledWith("spam:rate:u:c");
    expect(redis.expire).toHaveBeenCalled();
  });
  it("rejects after the Redis limit", async () => {
    redis.incr.mockResolvedValue(9);
    await expect(assertMessageNotSpam({ userId: "u", channelId: "c", content: "x" })).rejects.toMatchObject({ statusCode: 429 });
  });
});
