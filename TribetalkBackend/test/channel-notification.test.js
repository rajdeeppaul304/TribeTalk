import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = Object.fromEntries("findServerById createChannelDoc findChannelByIdWithServer saveChannelDoc deleteChannelDoc findChannelById isUserInServerMembers".split(" ").map((name) => [name, vi.fn()]));
const audit = { create: vi.fn() };
const bus = { emit: vi.fn() };
const channelModel = { findById: vi.fn() };
const serverModel = { findById: vi.fn() };
const userModel = { find: vi.fn() };
const notificationModel = { insertMany: vi.fn(), find: vi.fn(), updateMany: vi.fn() };
const events = { CHANNEL_CREATED: "channel.created" };
vi.mock("../src/Repository/Channel.repository.js", () => repo);
vi.mock("../src/Models/AuditLog.model.js", () => ({ AuditLog: audit }));
vi.mock("../src/events/eventBus.js", () => ({ eventBus: bus }));
vi.mock("../src/events/eventNames.js", () => ({ EVENTS: events }));
vi.mock("../src/Models/Channel.model.js", () => ({ Channel: channelModel }));
vi.mock("../src/Models/Server.model.js", () => ({ Server: serverModel }));
vi.mock("../src/Models/User.model.js", () => ({ User: userModel }));
vi.mock("../src/Models/Notification.model.js", () => ({ Notification: notificationModel }));
const service = await import("../src/Service/Channel.service.js");
const notifications = await import("../src/Service/Notification.service.js");
const oid = (value) => ({ toString: () => value });
const server = { _id: oid("s"), owner: oid("owner"), moderators: [oid("mod")], members: [oid("member")] };
beforeEach(() => { vi.clearAllMocks(); audit.create.mockResolvedValue({}); });

describe("channel service authorization and lifecycle", () => {
  it("creates, edits, deletes, and reads channels", async () => {
    repo.findServerById.mockResolvedValue(server); repo.createChannelDoc.mockResolvedValue({ _id: oid("c"), name: "general", description: "" });
    await expect(service.createChannel({ name: " General ", serverId: "s", userId: "owner" })).resolves.toMatchObject({ name: "general" });
    const channel = { _id: oid("c"), name: "old", description: "old", server };
    repo.findChannelByIdWithServer.mockResolvedValue(channel); repo.saveChannelDoc.mockResolvedValue({ ...channel, name: "new", description: "desc" });
    await expect(service.editChannel({ channelId: "c", name: " New ", description: " desc ", userId: "mod" })).resolves.toMatchObject({ name: "new" });
    await expect(service.getChannelInfo({ channelId: "c", userId: "member" })).resolves.toBe(channel);
    repo.deleteChannelDoc.mockResolvedValue(true);
    await expect(service.deleteChannel({ channelId: "c", userId: "owner" })).resolves.toBe(true);
    expect(bus.emit).toHaveBeenCalledWith(events.CHANNEL_CREATED, expect.anything());
  });
  it("rejects missing and unauthorized channels", async () => {
    repo.findServerById.mockResolvedValue(null);
    await expect(service.createChannel({ name: "general", serverId: "s", userId: "owner" })).rejects.toMatchObject({ statusCode: 404 });
    repo.findServerById.mockResolvedValue(server);
    await expect(service.createChannel({ name: "general", serverId: "s", userId: "member" })).rejects.toMatchObject({ statusCode: 403 });
    repo.findChannelByIdWithServer.mockResolvedValue(null);
    await expect(service.getChannelInfo({ channelId: "c", userId: "member" })).rejects.toMatchObject({ statusCode: 404 });
    repo.findChannelById.mockResolvedValue({ server: "s" });
    await expect(service.channelActivity({ channelId: "c" })).resolves.toBe("s");
    repo.isUserInServerMembers.mockResolvedValue(false);
    await expect(service.userCanJoin({ userId: "u", serverId: "s" })).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("notification service", () => {
  it("creates mention and unread notifications with preferences", async () => {
    channelModel.findById.mockReturnValue({ select: () => ({ lean: async () => ({ server: "s" }) }) });
    serverModel.findById.mockReturnValue({ select: () => ({ lean: async () => ({ owner: oid("owner"), moderators: [oid("mod")], members: [oid("member")] }) }) });
    userModel.find.mockReturnValue({ select: () => ({ lean: async () => [{ _id: oid("member"), username: "raj", notificationPreferences: {} }, { _id: oid("mod"), username: "mod", notificationPreferences: { unread: false } }] }) });
    notificationModel.insertMany.mockResolvedValue([{ recipient: oid("member"), type: "mention", toObject: () => ({ recipient: oid("member"), type: "mention" }) }]);
    await expect(notifications.createMessageNotifications({ message: { channel: oid("c"), _id: oid("m"), content: "hi @raj" }, senderId: "owner" })).resolves.toHaveLength(1);
    expect(notificationModel.insertMany).toHaveBeenCalled();
  });
  it("returns empty results for missing channel/server and supports listing/read updates", async () => {
    channelModel.findById.mockReturnValue({ select: () => ({ lean: async () => null }) });
    await expect(notifications.createMessageNotifications({ message: { channel: "c", _id: "m", content: "x" }, senderId: "u" })).resolves.toEqual([]);
    notificationModel.find.mockReturnValue({ sort: () => ({ limit: () => ({ populate: () => ({ lean: vi.fn() }) }) }) });
    notifications.listNotifications("u"); notifications.markNotificationsRead("u", ["n"]);
    expect(notificationModel.find).toHaveBeenCalled(); expect(notificationModel.updateMany).toHaveBeenCalled();
  });
});
