import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = {
  findServerByNameAndOwner: vi.fn(), createServerDoc: vi.fn(), findServerById: vi.fn(), deleteServerById: vi.fn(),
  findServersForUser: vi.fn(), findServerWithPopulatedUsers: vi.fn(), findActiveBan: vi.fn(), findChannelsByServerId: vi.fn(),
  addMemberToServer: vi.fn(), addModerator: vi.fn(), removeModerator: vi.fn(), removeMember: vi.fn(), createModerationAction: vi.fn(), revokeActiveBan: vi.fn(), listModerationActions: vi.fn(),
};
const invite = { create: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), find: vi.fn() };
const audit = { create: vi.fn() };
const notification = { create: vi.fn() };
const cache = { cacheKeys: { servers: vi.fn((id) => `servers:${id}`), server: vi.fn((s, u) => `server:${s}:${u}`) }, getCached: vi.fn(), setCached: vi.fn(), deleteCached: vi.fn() };
const bus = { emit: vi.fn() };
vi.mock("../src/Repository/Server.repository.js", () => repo);
vi.mock("../src/Models/Invite.model.js", () => ({ Invite: invite }));
vi.mock("../src/Models/AuditLog.model.js", () => ({ AuditLog: audit }));
vi.mock("../src/Models/Notification.model.js", () => ({ Notification: notification }));
vi.mock("../src/Service/Cache.service.js", () => cache);
vi.mock("../src/events/eventBus.js", () => ({ eventBus: bus }));
vi.mock("../src/events/eventNames.js", () => ({ EVENTS: { SERVER_MEMBER_JOINED: "server.member_joined", MODERATION_ACTION: "moderation.action" } }));

const service = await import("../src/Service/Server.service.js");
const id = (value) => ({ toString: () => value });
const baseServer = (owner = "owner") => ({ _id: id("s1"), owner: id(owner), moderators: [id(owner), id("mod")], members: [id(owner), id("mod"), id("member")], name: "Tribe", description: "Chat" });

beforeEach(() => {
  vi.clearAllMocks();
  cache.getCached.mockResolvedValue(null); cache.setCached.mockResolvedValue(true); cache.deleteCached.mockResolvedValue(true);
  audit.create.mockResolvedValue({}); notification.create.mockResolvedValue({});
});

describe("server service lifecycle", () => {
  it("creates a server and invite", async () => {
    repo.findServerByNameAndOwner.mockResolvedValue(null);
    const server = { _id: id("s1"), toObject: () => ({ _id: id("s1"), name: "Tribe" }) };
    repo.createServerDoc.mockResolvedValue(server); invite.create.mockResolvedValue({ code: "abc" });
    await expect(service.createServer({ name: " Tribe ", description: " Chat ", ownerId: "u1" })).resolves.toMatchObject({ name: "Tribe", inviteCode: "abc" });
    expect(repo.createServerDoc).toHaveBeenCalledWith(expect.objectContaining({ name: "Tribe", owner: "u1" }));
  });
  it("rejects duplicate and protects deletion", async () => {
    repo.findServerByNameAndOwner.mockResolvedValue({ _id: id("other") });
    await expect(service.createServer({ name: "Tribe", ownerId: "u1" })).rejects.toMatchObject({ statusCode: 409 });
    repo.findServerById.mockResolvedValue(null);
    await expect(service.deleteServer({ serverId: "s1", userId: "u1" })).rejects.toMatchObject({ statusCode: 404 });
    repo.findServerById.mockResolvedValue(baseServer("owner"));
    await expect(service.deleteServer({ serverId: "s1", userId: "member" })).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.deleteServer({ serverId: "s1", userId: "owner" })).resolves.toBe(true);
  });
  it("lists cached servers and maps owner/moderator roles", async () => {
    cache.getCached.mockResolvedValueOnce([{ _id: "cached" }]);
    await expect(service.listServers("u1")).resolves.toEqual([{ _id: "cached" }]);
    cache.getCached.mockResolvedValue(null);
    repo.findServersForUser.mockResolvedValue([baseServer("owner")]);
    invite.findOne.mockReturnValue({ sort: () => ({ lean: async () => ({ code: "abc" }) }) });
    await expect(service.listServers("owner")).resolves.toMatchObject([{ role: "owner", inviteCode: "abc" }]);
    await expect(service.listServers("mod")).resolves.toMatchObject([{ role: "moderator" }]);
  });
  it("returns server details and enforces membership and bans", async () => {
    const populated = { ...baseServer("owner"), owner: { _id: id("owner"), username: "owner" }, moderators: [{ _id: id("mod"), username: "mod" }], members: [{ _id: id("member"), username: "member" }] };
    repo.findServerWithPopulatedUsers.mockResolvedValue(populated); repo.findActiveBan.mockResolvedValue(null); repo.findChannelsByServerId.mockResolvedValue([]);
    await expect(service.getServerInfo({ serverId: "s1", userId: "member" })).resolves.toMatchObject({ role: "member", channels: [] });
    repo.findActiveBan.mockResolvedValue({});
    await expect(service.getServerInfo({ serverId: "s1", userId: "member" })).rejects.toMatchObject({ statusCode: 403 });
    repo.findActiveBan.mockResolvedValue(null);
    await expect(service.getServerInfo({ serverId: "s1", userId: "stranger" })).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("server invites, roles, and moderation", () => {
  it("joins once, reserves invite usage, and emits an event", async () => {
    repo.findServerById.mockResolvedValue(baseServer("owner"));
    invite.findOne.mockResolvedValue({ _id: id("i1"), code: "abc", uses: 0, maxUses: 10, expiresAt: null });
    invite.findOneAndUpdate.mockResolvedValue({ _id: id("i1") }); repo.addMemberToServer.mockResolvedValue({ _id: id("s1"), name: "Tribe" });
    await expect(service.joinServer({ serverId: "s1", userId: "new", inviteCode: "abc" })).resolves.toMatchObject({ name: "Tribe" });
    expect(bus.emit).toHaveBeenCalled();
    await expect(service.joinServer({ serverId: "s1", userId: "member", inviteCode: "abc" })).rejects.toMatchObject({ statusCode: 400 });
  });
  it("creates and revokes moderator invites", async () => {
    repo.findServerById.mockResolvedValue(baseServer("owner"));
    invite.create.mockResolvedValue({ _id: id("i1"), maxUses: 2 });
    await expect(service.createInvite({ serverId: "s1", userId: "mod", maxUses: 2 })).resolves.toMatchObject({ maxUses: 2 });
    invite.find.mockReturnValue({ sort: () => ({ lean: async () => [] }) });
    await expect(service.listInvites({ serverId: "s1", userId: "mod" })).resolves.toEqual([]);
    invite.findOneAndUpdate.mockResolvedValue({ _id: id("i1") });
    await expect(service.revokeInvite({ serverId: "s1", inviteId: "i1", userId: "mod" })).resolves.toBeTruthy();
  });
  it("promotes, demotes, removes members, and rejects protected targets", async () => {
    repo.findServerById.mockResolvedValue(baseServer("owner"));
    await expect(service.setMemberRole({ serverId: "s1", memberId: "member", role: "moderator", userId: "owner" })).resolves.toBe(true);
    await expect(service.setMemberRole({ serverId: "s1", memberId: "owner", role: "member", userId: "owner" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.removeMember({ serverId: "s1", memberId: "member", userId: "mod" })).resolves.toBe(true);
    await expect(service.removeMember({ serverId: "s1", memberId: "mod", userId: "mod" })).rejects.toMatchObject({ statusCode: 403 });
  });
  it("records warnings, bans, and unbans", async () => {
    repo.findServerById.mockResolvedValue(baseServer("owner"));
    repo.createModerationAction.mockResolvedValue({ _id: id("a1"), reason: "spam" });
    await expect(service.warnMember({ serverId: "s1", memberId: "member", userId: "mod", reason: " spam " })).resolves.toMatchObject({ reason: "spam" });
    repo.revokeActiveBan.mockResolvedValue(null);
    await expect(service.banMember({ serverId: "s1", memberId: "member", userId: "mod", durationMinutes: 5, reason: "spam" })).resolves.toBeTruthy();
    await expect(service.unbanMember({ serverId: "s1", memberId: "member", userId: "mod" })).rejects.toMatchObject({ statusCode: 404 });
    repo.revokeActiveBan.mockResolvedValue({ _id: id("a1") });
    await expect(service.unbanMember({ serverId: "s1", memberId: "member", userId: "mod" })).resolves.toBeTruthy();
  });
});
