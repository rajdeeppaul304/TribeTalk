import { beforeEach, describe, expect, it, vi } from "vitest";

const access = { checkChannelAccess: vi.fn() };
vi.mock("../src/Service/Permission.service.js", () => access);
const { verifyChannelAccess } = await import("../src/Middlewares/ChannelAccess.middleware.js");

beforeEach(() => { vi.clearAllMocks(); access.checkChannelAccess.mockResolvedValue(true); });
const run = async (req) => { const next = vi.fn(); await verifyChannelAccess(req, {}, next); await new Promise((resolve) => setImmediate(resolve)); return next; };

describe("channel access middleware", () => {
  it("requires and validates a channel id", async () => {
    const missing = await run({ params: {}, body: {}, query: {}, user: { _id: "u1" } });
    expect(missing).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    const invalid = await run({ params: { channelId: "not-an-object-id" }, user: { _id: "u1" } });
    expect(invalid).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it("requires an authenticated user and membership", async () => {
    const unauthenticated = await run({ params: { channelId: "507f1f77bcf86cd799439011" }, user: {} });
    expect(unauthenticated).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    access.checkChannelAccess.mockResolvedValue(false);
    const denied = await run({ params: { channelId: "507f1f77bcf86cd799439011" }, user: { _id: "u1" } });
    expect(denied).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("accepts ids from body/query and attaches the resolved id", async () => {
    const req = { body: { channelId: "507f1f77bcf86cd799439011" }, params: {}, query: {}, user: { _id: "u1" } };
    const next = await run(req);
    expect(req.channelId).toBe(req.body.channelId);
    expect(next).toHaveBeenCalledWith();
  });
});
