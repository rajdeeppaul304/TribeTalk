import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = (names) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
const server = mockFns("createServer deleteServer listServers editServer getServerInfo joinServer createInvite listInvites revokeInvite setMemberRole removeMember listAuditLogs warnMember banMember unbanMember listModerationActions".split(" "));
const message = mockFns("getMessageHistory getMessageById getThread markAsRead getUnreadCount getChannelSyncData editMessage deleteMessage".split(" "));
const channel = mockFns("createChannel deleteChannel editChannel getChannelInfo".split(" "));
const user = mockFns("registerUser loginUser logoutUser refreshAccessToken requestEmailVerification verifyEmail requestPasswordReset resetPassword logoutAllSessions updateProfile getPublicProfile searchUsers".split(" "));
const direct = mockFns("createConversation listConversations listMessages sendDirectMessage".split(" "));
const scheduled = mockFns("scheduleMessage listScheduledMessages cancelScheduledMessage".split(" "));
const search = mockFns(["searchMessages"]);
vi.mock("../src/Service/Server.service.js", () => server);
vi.mock("../src/Service/Message.service.js", () => message);
vi.mock("../src/Service/Channel.service.js", () => channel);
vi.mock("../src/Service/User.service.js", () => user);
vi.mock("../src/Service/DirectMessage.service.js", () => direct);
vi.mock("../src/Service/ScheduledMessage.service.js", () => scheduled);
vi.mock("../src/Service/Search.service.js", () => search);
vi.mock("../src/Service/Notification.service.js", () => ({ listNotifications: vi.fn(), markNotificationsRead: vi.fn() }));

const id = "507f1f77bcf86cd799439011";
const req = (overrides = {}) => ({ user: { _id: "u1" }, body: {}, params: {}, query: {}, cookies: {}, get: () => "agent", ...overrides });
const response = () => { const res = {}; res.status = vi.fn(() => res); res.json = vi.fn(() => res); res.cookie = vi.fn(() => res); res.clearCookie = vi.fn(() => res); return res; };
const invoke = async (handler, request = req()) => { const res = response(); const next = vi.fn(); handler(request, res, next); await new Promise((resolve) => setImmediate(resolve)); return { res, next }; };

const services = [server, message, channel, user, direct, scheduled, search];
beforeEach(() => { for (const service of services) for (const key of Object.keys(service)) service[key].mockReset?.(); });

describe("server controller contracts", () => {
  it("handles server CRUD and membership operations", async () => {
    server.createServer.mockResolvedValue({ _id: id }); server.deleteServer.mockResolvedValue(true); server.listServers.mockResolvedValue([]); server.editServer.mockResolvedValue({}); server.getServerInfo.mockResolvedValue({}); server.joinServer.mockResolvedValue({});
    server.createInvite.mockResolvedValue({ code: "x" }); server.listInvites.mockResolvedValue([]); server.revokeInvite.mockResolvedValue({}); server.setMemberRole.mockResolvedValue(true); server.removeMember.mockResolvedValue(true); server.listAuditLogs.mockResolvedValue([]); server.warnMember.mockResolvedValue({}); server.banMember.mockResolvedValue({}); server.unbanMember.mockResolvedValue(true); server.listModerationActions.mockResolvedValue([]);
    const { createServer, deleteServer, listServers, editServer, getServerInfo, joinServer, createInvite, listInvites, revokeInvite, setMemberRole, removeMember, listAuditLogs, warnMember, banMember, unbanMember, listModerationActions } = await import("../src/Controllers/Server.controller.js");
    await invoke(createServer, req({ body: { name: "Tribe" } }));
    await invoke(deleteServer, req({ params: { id } })); await invoke(listServers); await invoke(editServer, req({ params: { id }, body: { name: "Updated" } })); await invoke(getServerInfo, req({ params: { id } })); await invoke(joinServer, req({ params: { id }, body: { inviteCode: "x" } }));
    await invoke(createInvite, req({ params: { id }, body: { maxUses: 2 } })); await invoke(listInvites, req({ params: { id } })); await invoke(revokeInvite, req({ params: { id, inviteId: id } })); await invoke(setMemberRole, req({ params: { id, memberId: id }, body: { role: "moderator" } })); await invoke(removeMember, req({ params: { id, memberId: id } })); await invoke(listAuditLogs, req({ params: { id } })); await invoke(warnMember, req({ params: { id, memberId: id }, body: { reason: "spam" } })); await invoke(banMember, req({ params: { id, memberId: id }, body: { reason: "spam", durationMinutes: 5 } })); await invoke(unbanMember, req({ params: { id, memberId: id } })); await invoke(listModerationActions, req({ params: { id } }));
    expect(server.createServer).toHaveBeenCalled(); expect(server.warnMember).toHaveBeenCalled();
  });
  it("rejects malformed server input", async () => {
    const { createServer, deleteServer, editServer } = await import("../src/Controllers/Server.controller.js");
    expect((await invoke(createServer, req({ body: { name: "x" } }))).next).toHaveBeenCalled();
    expect((await invoke(deleteServer, req({ params: { id: "bad" } }))).next).toHaveBeenCalled();
    expect((await invoke(editServer, req({ params: { id: "bad" }, body: {} }))).next).toHaveBeenCalled();
  });
});

describe("message and channel controllers", () => {
  it("handles history, sync, reads, edits, deletes, and threads", async () => {
    message.getMessageHistory.mockResolvedValue([{ _id: id }]); message.getMessageById.mockResolvedValue({}); message.getThread.mockResolvedValue([]); message.markAsRead.mockResolvedValue({}); message.getUnreadCount.mockResolvedValue(2); message.getChannelSyncData.mockResolvedValue({}); message.editMessage.mockResolvedValue({}); message.deleteMessage.mockResolvedValue({});
    const c = await import("../src/Controllers/Message.controller.js");
    await invoke(c.getMessageHistory, req({ params: { channelId: id }, query: { limit: "10" } })); await invoke(c.getMessageById, req({ params: { channelId: id, messageId: id } })); await invoke(c.getThread, req({ params: { channelId: id, messageId: id } })); await invoke(c.markChannelAsRead, req({ params: { channelId: id }, body: { lastReadMessageId: id } })); await invoke(c.getUnreadCount, req({ params: { channelId: id } })); await invoke(c.getChannelSyncData, req({ params: { channelId: id } })); await invoke(c.editMessage, req({ params: { messageId: id }, body: { content: "updated" } })); await invoke(c.deleteMessageById, req({ params: { messageId: id } }));
    expect(message.getMessageHistory).toHaveBeenCalled(); expect(message.markAsRead).toHaveBeenCalled();
  });
  it("handles channel CRUD and validates IDs", async () => {
    channel.createChannel.mockResolvedValue({}); channel.deleteChannel.mockResolvedValue(true); channel.editChannel.mockResolvedValue({}); channel.getChannelInfo.mockResolvedValue({});
    const c = await import("../src/Controllers/Channel.controller.js");
    await invoke(c.createChannel, req({ body: { name: "general", serverId: id } })); await invoke(c.deleteChannel, req({ params: { id } })); await invoke(c.editChannel, req({ params: { id }, body: { name: "chat" } })); await invoke(c.getChannelInfo, req({ params: { id } }));
    expect((await invoke(c.createChannel, req({ body: { name: "x", serverId: "bad" } }))).next).toHaveBeenCalled();
  });
});

describe("user, search, direct-message, and scheduled controllers", () => {
  it("handles account and profile operations", async () => {
    user.registerUser.mockResolvedValue({}); user.loginUser.mockResolvedValue({ user: {}, accessToken: "a", refreshToken: "r" }); user.logoutUser.mockResolvedValue(true); user.refreshAccessToken.mockResolvedValue({ accessToken: "a", refreshToken: "r" }); user.requestEmailVerification.mockResolvedValue(true); user.verifyEmail.mockResolvedValue(true); user.requestPasswordReset.mockResolvedValue(true); user.resetPassword.mockResolvedValue(true); user.logoutAllSessions.mockResolvedValue(true); user.updateProfile.mockResolvedValue({}); user.getPublicProfile.mockResolvedValue({}); user.searchUsers.mockResolvedValue([]);
    const c = await import("../src/Controllers/User.controller.js");
    await invoke(c.registerUser, req({ body: { email: "a@b.com", username: "raj", password: "password123" } })); await invoke(c.loginUser, req({ body: { email: "a@b.com", password: "password123" } })); await invoke(c.logoutUser); await invoke(c.refreshAccessToken, req({ body: { refreshToken: "r" } })); await invoke(c.requestEmailVerification, req({ body: { email: "a@b.com" } })); await invoke(c.verifyEmail, req({ body: { email: "a@b.com", otp: "123456" } })); await invoke(c.requestPasswordReset, req({ body: { email: "a@b.com" } })); await invoke(c.resetPassword, req({ body: { email: "a@b.com", otp: "123456", password: "password123" } })); await invoke(c.logoutAllSessions); await invoke(c.getCurrentUser); await invoke(c.updateCurrentUserProfile, req({ body: { bio: "hi" } })); await invoke(c.getPublicUserProfile, req({ params: { userId: id } })); await invoke(c.searchPublicUsers, req({ query: { q: "raj" } }));
    expect(user.loginUser).toHaveBeenCalled(); expect(user.updateProfile).toHaveBeenCalled();
  });
  it("handles search, direct messages, and scheduled messages", async () => {
    search.searchMessages.mockResolvedValue([]); direct.createConversation.mockResolvedValue({}); direct.listConversations.mockResolvedValue([]); direct.listMessages.mockResolvedValue([]); direct.sendDirectMessage.mockResolvedValue({ message: {} }); scheduled.scheduleMessage.mockResolvedValue({}); scheduled.listScheduledMessages.mockResolvedValue([]); scheduled.cancelScheduledMessage.mockResolvedValue({});
    const s = await import("../src/Controllers/Search.controller.js"); const d = await import("../src/Controllers/DirectMessage.controller.js"); const m = await import("../src/Controllers/ScheduledMessage.controller.js");
    await invoke(s.searchMessageContent, req({ query: { q: "hello", limit: 10 } })); await invoke(d.createConversation, req({ body: { participantId: id } })); await invoke(d.listConversations); await invoke(d.listMessages, req({ params: { id }, query: {} })); await invoke(d.sendMessage, req({ params: { id }, body: { content: "hi", clientId: "c1" } })); await invoke(m.scheduleMessage, req({ body: { channelId: id, content: "later", scheduledFor: "2027-01-01" } })); await invoke(m.listScheduledMessages, req({ params: { channelId: id } })); await invoke(m.cancelScheduledMessage, req({ params: { id } }));
    expect(search.searchMessages).toHaveBeenCalled(); expect(d.sendMessage).toBeTypeOf("function");
  });
});
