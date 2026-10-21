import { describe, expect, it } from "vitest";
import { metrics, trackDependency } from "../src/config/metrics.js";

describe("metrics instrumentation", () => {
  it("tracks counters, gauges, dependency timing, and exports Prometheus text", async () => {
    metrics.increment("httpRequests");
    metrics.increment("activeSockets");
    metrics.decrement("activeSockets");
    metrics.observeHttp(12, 200);
    metrics.observeHttp(20, 500);
    metrics.observeDependency("mongo", "find", 2);
    metrics.cacheHit("profile");
    metrics.cacheMiss("profile");
    metrics.cacheWrite("profile", "success");
    await expect(trackDependency("redis", "get", async () => "ok")).resolves.toBe("ok");
    await expect(trackDependency("redis", "get", async () => { throw new Error("down"); })).rejects.toThrow("down");
    expect(metrics.snapshot()).toMatchObject({ httpRequests: expect.any(Number), activeSockets: expect.any(Number), uptimeSeconds: expect.any(Number) });
    await expect(metrics.prometheus()).resolves.toContain("tribetalk_http_requests_total");
  });
});
