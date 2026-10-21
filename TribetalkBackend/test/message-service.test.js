import { beforeEach, describe, expect, it, vi } from "vitest";
const repo = Object.fromEntries("createMessage getMessages findMessageByIdAndChannel getMessagesSinceSequence getThreadMessages findMessageById updateMessageContent softDeleteMessage findReadState getLatestMessage upsertReadState countUnreadMessages findAllUserReadStates".split(" ").map((name) => [name, vi.fn()]));
const messageModel = { findById: vi.fn(), findOne: vi.fn() }; const channelModel = { findById: vi.fn() }; const serverModel = { findById: vi.fn() }; const audit = { create: vi.fn() };
vi.mock("../src/Repository/Message.repository.js", () => repo);
vi.mock("../src/Repository/Server.repository.js", () => ({ findUserAccessibleChannelIds: vi.fn() }));
vi.mock("../src/Service/Permission.service.js", () => ({ checkChannelAccess: vi.fn(), canModerate: vi.fn() }));
vi.mock("../src/Service/Search.service.js", () => ({ indexMessage: vi.fn(), removeMessageFromIndex: vi.fn() }));
vi.mock("../src/Models/Message.model.js", () => ({ Message: messageModel })); vi.mock("../src/Models/Channel.model.js", () => ({ Channel: channelModel })); vi.mock("../src/Models/Server.model.js", () => ({ Server: serverModel })); vi.mock("../src/Models/AuditLog.model.js", () => ({ AuditLog: audit }));
const permission = await import("../src/Service/Permission.service.js"); const serverRepo = await import("../src/Repository/Server.repository.js"); const service = await import("../src/Service/Message.service.js");
const oid = (value) => ({ toString: () => value });
const populated = () => ({ populate: vi.fn(async () => undefined) });
beforeEach(() => { vi.clearAllMocks(); permission.checkChannelAccess.mockResolvedValue(true); permission.canModerate.mockReturnValue(true); audit.create.mockResolvedValue({}); serverRepo.findUserAccessibleChannelIds.mockResolvedValue([]); });

describe("message service domain behavior", () => {
  it("creates messages, replies, and validates required fields", async () => {
    repo.createMessage.mockResolvedValue(populated()); messageModel.findOne.mockReturnValue({ select: () => ({ lean: async () => ({ _id: "root", threadRoot: null }) }) });
    await expect(service.addMessage({ content: " hello ", channelId: "c", UserId: "u", replyTo: "root" })).resolves.toBeTruthy();
    await expect(service.addMessage({ content: "", channelId: "c", UserId: "u" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.addMessage({ content: "x", channelId: "c" })).rejects.toMatchObject({ statusCode: 400 });
    messageModel.findOne.mockReturnValue({ select: () => ({ lean: async () => null }) });
    await expect(service.addMessage({ content: "x", channelId: "c", UserId: "u", replyTo: "bad" })).rejects.toMatchObject({ statusCode: 404 });
  });
  it("handles history, threads, sync and unread state", async () => {
    repo.getMessages.mockResolvedValue([]); await expect(service.getMessageHistory({ channelId: "c", userId: "u" })).resolves.toEqual([]);
    repo.findMessageByIdAndChannel.mockResolvedValue({ populate: vi.fn(async () => ({ id: "m" })) }); await expect(service.getMessageById({ channelId: "c", messageId: "m", userId: "u" })).resolves.toEqual({ id: "m" });
    messageModel.findOne.mockReturnValue({ select: () => ({ lean: async () => ({ _id: "r", threadRoot: null }) }) }); repo.getThreadMessages.mockResolvedValue([]); await expect(service.getThread({ channelId: "c", rootId: "r", userId: "u" })).resolves.toEqual([]);
    repo.getMessagesSinceSequence.mockResolvedValue([]); await expect(service.getMissedMessages("c", 2, "u")).resolves.toEqual([]);
    repo.getLatestMessage.mockResolvedValue({ _id: "m", sequence: 5 }); repo.findReadState.mockResolvedValue({ lastReadSequence: 2 }); repo.countUnreadMessages.mockResolvedValue(3); await expect(service.getChannelSyncData("u", "c")).resolves.toMatchObject({ latestSequence: 5, unreadCount: 3 });
    await expect(service.getUnreadCount("u", "c")).resolves.toBe(3);
    serverRepo.findUserAccessibleChannelIds.mockResolvedValue(["c1", "c2"]); repo.findAllUserReadStates.mockResolvedValue([{ channel: oid("c1"), lastReadSequence: 2 }]); repo.countUnreadMessages.mockResolvedValueOnce(1).mockResolvedValueOnce(0); await expect(service.getUnreadCountsForUser("u")).resolves.toEqual({ c1: 1 });
  });
  it("edits and deletes messages with author/moderator checks", async () => {
    const msg = { channel: "c", sender: "u" }; repo.findMessageById.mockResolvedValue(msg); repo.updateMessageContent.mockResolvedValue({ _id: "m" }); await expect(service.editMessage("m", " updated ", "u")).resolves.toEqual({ _id: "m" });
    await expect(service.editMessage("m", " ", "u")).rejects.toMatchObject({ statusCode: 400 });
    channelModel.findById.mockReturnValue({ select: () => ({ lean: async () => ({ server: "s" }) }) }); serverModel.findById.mockReturnValue({ select: () => ({ lean: async () => ({ _id: "s", moderators: [], owner: "o", members: [] }) }) }); permission.canModerate.mockReturnValue(true); repo.softDeleteMessage.mockResolvedValue({ _id: "m", channel: "c" }); await expect(service.deleteMessage("m", "mod")).resolves.toBeTruthy();
    repo.findMessageById.mockResolvedValue({ channel: "c", sender: "other" }); permission.canModerate.mockReturnValue(false); await expect(service.deleteMessage("m", "u")).rejects.toMatchObject({ statusCode: 403 });
  });
  it("toggles reactions and pins", async () => {
    const reaction = { emoji: "👍", users: { some: () => false, addToSet: vi.fn(), length: 1 } }; const msg = { channel: "c", deletedAt: null, reactions: [reaction], save: vi.fn(), populate: vi.fn(async () => undefined), pinnedAt: null };
    messageModel.findById.mockResolvedValue(msg); await expect(service.toggleReaction({ messageId: "m", emoji: "👍", userId: "u" })).resolves.toBe(msg); expect(msg.save).toHaveBeenCalled();
    channelModel.findById.mockReturnValue({ select: () => ({ lean: async () => ({ server: "s" }) }) }); serverModel.findById.mockReturnValue({ select: () => ({ lean: async () => ({ _id: "s", owner: "o", moderators: ["mod"], members: [] }) }) }); permission.canModerate.mockReturnValue(true); await expect(service.togglePin({ messageId: "m", userId: "mod" })).resolves.toBe(msg); expect(msg.pinnedAt).toBeTruthy();
  });
  it("marks messages as read and returns read states", async () => {
    repo.findMessageByIdAndChannel.mockResolvedValue({ _id: "m", sequence: 4 }); repo.findReadState.mockResolvedValue(null); repo.upsertReadState.mockResolvedValue({ lastReadSequence: 4 }); await expect(service.markAsRead("u", "c", "m")).resolves.toMatchObject({ lastReadSequence: 4 });
    repo.getReadState = repo.findReadState; await expect(service.getReadState("u", "c")).resolves.toBeNull();
    repo.findMessageByIdAndChannel.mockResolvedValue(null); await expect(service.markAsRead("u", "c", "bad")).rejects.toMatchObject({ statusCode: 404 });
  });
});
