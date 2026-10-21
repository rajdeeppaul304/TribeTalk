import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/Utils/ApiError.js";
import { ApiResponse } from "../src/Utils/ApiResponse.js";
import { asyncHandler } from "../src/Utils/asyncHandler.js";
import { formatMessageDTO } from "../src/socket/socket.utils.js";
import { validate } from "../src/Middlewares/Validate.middleware.js";
import { errorHandler } from "../src/Middlewares/Error.middleware.js";
import { getServerRole, canModerate } from "../src/Service/Permission.service.js";

describe("core response and error utilities", () => {
  it("creates successful and failed response envelopes", () => {
    expect(new ApiResponse(201, { id: 1 }, "Created")).toMatchObject({ statusCode: 201, success: true, message: "Created" });
    expect(new ApiError(422, "Invalid", [{ field: "x" }])).toMatchObject({ statusCode: 422, success: false, errors: [{ field: "x" }] });
  });

  it("forwards async handler failures to next", async () => {
    const next = vi.fn();
    asyncHandler(async () => { throw new Error("boom"); })({}, {}, next);
    await new Promise((resolve) => setImmediate(resolve));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
  });

  it("serializes client and server errors consistently", () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    errorHandler(new ApiError(400, "Bad input", [{ field: "email" }]), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: "Bad input" }));
    errorHandler(new Error("secret"), {}, res, vi.fn());
    expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ statusCode: 500, message: "Internal server error" }));
  });
});

describe("validation and permissions", () => {
  it("passes parsed values and reports schema issues", () => {
    const next = vi.fn();
    const schema = { safeParse: vi.fn(() => ({ success: true, data: { body: { ok: true }, params: {}, query: {} } })) };
    const req = { body: {}, params: {}, query: {} };
    validate(schema)(req, {}, next);
    expect(req.body).toEqual({ ok: true });
    expect(next).toHaveBeenCalledWith();
    const failed = { safeParse: () => ({ success: false, error: { issues: [{ path: ["body", "name"], message: "Required" }] } }) };
    const failNext = vi.fn();
    validate(failed)({ body: {}, params: {}, query: {} }, {}, failNext);
    expect(failNext.mock.calls[0][0]).toMatchObject({ statusCode: 400, errors: [{ field: "body.name" }] });
  });

  it("resolves owner, moderator, member, and missing roles", () => {
    const server = { owner: "owner", moderators: ["mod"], members: ["member"] };
    expect(getServerRole(server, "owner")).toBe("owner");
    expect(getServerRole(server, "mod")).toBe("moderator");
    expect(getServerRole(server, "member")).toBe("member");
    expect(getServerRole(server, "unknown")).toBeNull();
    expect(canModerate(server, "owner")).toBe(true);
    expect(canModerate(server, "member")).toBe(false);
  });
});

describe("message DTO", () => {
  it("normalizes populated messages and reaction fields", () => {
    const dto = formatMessageDTO({ _id: "m1", content: "hello", sender: { _id: "u1", username: "raj", avatar: "a" }, channelId: "c1", createdAt: new Date("2026-01-01"), editedAt: new Date("2026-01-02"), reactions: [{ emoji: "👍", users: ["u1"] }], replyTo: "r1", pinnedAt: new Date("2026-01-03") });
    expect(dto).toMatchObject({ id: "m1", senderId: "u1", senderUsername: "raj", channelId: "c1", isEdited: false, replyTo: "r1", pinnedAt: "2026-01-03T00:00:00.000Z" });
    expect(dto.reactions).toEqual([{ emoji: "👍", userIds: ["u1"] }]);
  });

  it("falls back to raw sender/user ids and defaults", () => {
    const dto = formatMessageDTO({ id: "m2", content: "x", user: "u2", channel: "c2", isEdited: true, isSystemMessage: true });
    expect(dto).toMatchObject({ id: "m2", senderId: "u2", senderUsername: null, channelId: "c2", isEdited: true, isSystemMessage: true, attachments: [] });
  });
});
