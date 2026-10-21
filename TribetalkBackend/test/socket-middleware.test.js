import { beforeEach, describe, expect, it, vi } from "vitest";
const redis = { incr: vi.fn(), expire: vi.fn() }; const access = { getUserFromToken: vi.fn() }; const permission = { checkChannelAccess: vi.fn() }; const metrics = { increment: vi.fn() };
vi.mock("../src/config/redis.js", () => ({ getRedisClient: () => redis, isRedisReady: () => true })); vi.mock("../src/Middlewares/Auth.middleware.js", () => access); vi.mock("../src/Service/Permission.service.js", () => permission); vi.mock("../src/config/metrics.js", () => ({ metrics })); vi.mock("../src/config/env.js", () => ({ env: { NODE_ENV: "test", LOAD_TEST_MODE: false, LOAD_TEST_KEY: null } }));
const { socketEventMiddleware } = await import("../src/socket/event.middleware.js"); const { socketAuthMiddleware, channelGuardMiddleware } = await import("../src/socket/socket.middleware.js");
beforeEach(() => { vi.clearAllMocks(); redis.incr.mockResolvedValue(1); redis.expire.mockResolvedValue(1); permission.checkChannelAccess.mockResolvedValue(true); access.getUserFromToken.mockResolvedValue({ _id: "u1" }); });
describe("socket authentication and authorization", () => {
  it("authenticates handshake tokens and rejects missing/invalid tokens", async () => {
    const next = vi.fn(); const socket = { handshake: { auth: { token: "good" }, headers: {} } }; await socketAuthMiddleware(socket, next); expect(socket.user).toMatchObject({ _id: "u1" }); expect(next).toHaveBeenCalledWith();
    const missing = vi.fn(); await socketAuthMiddleware({ handshake: { auth: {}, headers: {} } }, missing); expect(missing.mock.calls[0][0].message).toMatch(/missing/);
    access.getUserFromToken.mockResolvedValue(null); const invalid = vi.fn(); await socketAuthMiddleware({ handshake: { auth: { token: "bad" }, headers: {} } }, invalid); expect(invalid.mock.calls[0][0].message).toMatch(/Invalid/);
    access.getUserFromToken.mockRejectedValue(new Error("x")); const failed = vi.fn(); await socketAuthMiddleware({ handshake: { auth: { token: "bad" }, headers: {} } }, failed); expect(failed.mock.calls[0][0].message).toMatch(/failed/i);
  });
  it("accepts authorization header and guards channels", async () => {
    const next = vi.fn(); await socketAuthMiddleware({ handshake: { auth: {}, headers: { authorization: "Bearer token" } } }, next); expect(access.getUserFromToken).toHaveBeenCalledWith("token");
    const socket = { user: { _id: "u1" } }; const guard = channelGuardMiddleware(socket); const pass = vi.fn(); await guard(["send_message", { channelId: "c" }], pass); expect(pass).toHaveBeenCalledWith();
    const missing = vi.fn(); await guard(["send_message", {}], missing); expect(missing.mock.calls[0][0].message).toMatch(/channelId/);
    permission.checkChannelAccess.mockResolvedValue(false); const denied = vi.fn(); await guard(["join_channel", { channelId: "c" }], denied); expect(denied.mock.calls[0][0].message).toMatch(/Access denied/);
  });
});
describe("socket packet validation and limits", () => {
  it("validates payloads and rate limits events", async () => {
    const socket = { user: { _id: "u1" }, handshake: { auth: {} } }; const middleware = socketEventMiddleware(socket); const valid = vi.fn(); await middleware(["join_channel", { channelId: "507f1f77bcf86cd799439011" }], valid); expect(valid).toHaveBeenCalledWith();
    const invalid = vi.fn(); await middleware(["join_channel", { channelId: "bad" }], invalid); expect(invalid.mock.calls[0][0].message).toMatch(/Invalid payload/);
    redis.incr.mockResolvedValue(1000); const limited = vi.fn(); await middleware(["send_message", { channelId: "507f1f77bcf86cd799439011", content: "hi" }], limited); expect(limited.mock.calls[0][0].message).toMatch(/rate limit/);
    redis.incr.mockResolvedValue(1); const unknown = vi.fn(); await middleware(["unknown", {}], unknown); expect(unknown).toHaveBeenCalledWith();
  });
});
