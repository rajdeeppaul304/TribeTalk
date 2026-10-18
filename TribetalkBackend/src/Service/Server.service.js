//Server.service.js
import * as serverRepo from "../Repository/Server.repository.js";
import { ApiError } from "../Utils/ApiError.js";
import { eventBus } from "../events/eventBus.js";
import { EVENTS } from "../events/eventNames.js";
import { Invite } from "../Models/Invite.model.js";
import { AuditLog } from "../Models/AuditLog.model.js";
import { getServerRole, canModerate } from "./Permission.service.js";
import { cacheKeys, deleteCached, getCached, setCached } from "./Cache.service.js";
import { Notification } from "../Models/Notification.model.js";

const audit = (server, actor, action, extra = {}) => AuditLog.create({ server, actor, action, ...extra });
const assertModerator = (server, userId) => {
  if (!canModerate(server, userId)) throw new ApiError(403, "Owner or moderator permission required");
};
const assertOwner = (server, userId) => {
  if (getServerRole(server, userId) !== "owner") throw new ApiError(403, "Only the server owner can perform this action");
};


export const createServer = async ({ name, description, ownerId }) => {
    const trimmedName = name.trim();

    const existingServer = await serverRepo.findServerByNameAndOwner(trimmedName, ownerId);
    if (existingServer) {
        throw new ApiError(409, "You already have a server with this name");
    }

    const server = await serverRepo.createServerDoc({
        name: trimmedName,
        description: description?.trim() || "",
        owner: ownerId,
        moderators: [ownerId],
        members: [ownerId]
    });
    const invite = await Invite.create({ server: server._id, createdBy: ownerId });
    return { ...server.toObject(), inviteCode: invite.code };
};

export const deleteServer = async ({ serverId, userId }) => {
    const server = await serverRepo.findServerById(serverId);
    if (!server) {
        throw new ApiError(404, "Server not found");
    }

    if (server.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You are not authorized to delete this server");
    }

    await serverRepo.deleteServerById(serverId);
    return true;
};

export const listServers = async (userId) => {
    const cached = await getCached(cacheKeys.servers(userId));
    if (cached) return cached;
    const servers = await serverRepo.findServersForUser(userId);

    const result = await Promise.all(servers.map(async (server) => {
        // Existing servers get one migration-friendly default invite. New links use Invite documents.
        let invite = await Invite.findOne({ server: server._id, revokedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).sort({ createdAt: -1 }).lean();
        if (!invite) invite = (await Invite.create({ server: server._id, createdBy: server.owner })).toObject();
        let role = "member";

        if (server.owner.toString() === userId.toString()) {
            role = "owner";
        } else if (server.moderators.some((modId) => modId.toString() === userId.toString())) {
            role = "moderator";
        }

        return {
            _id: server._id,
            name: server.name,
            description: server.description,
            role,
            inviteCode: invite.code
        };
    }));
    await setCached(cacheKeys.servers(userId), result, 15);
    return result;
};

export const editServer = async ({ serverId, name, description, userId }) => {
    const server = await serverRepo.findServerById(serverId);
    if (!server) {
        throw new ApiError(404, "Server not found");
    }

    if (server.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "Only the owner can edit the server");
    }

    if (name) {
        const trimmedName = name.trim();
        const existingServer = await serverRepo.findServerByNameAndOwner(trimmedName, userId);

        if (existingServer && existingServer._id.toString() !== serverId) {
            throw new ApiError(409, "You already have a server with this name");
        }
        server.name = trimmedName;
    }

    if (description !== undefined) {
        server.description = description.trim();
    }

    const updatedServer = await serverRepo.saveServerDoc(server);
    await deleteCached(cacheKeys.server(serverId, userId), cacheKeys.servers(userId));
    await audit(serverId, userId, "server.updated", { metadata: { name: updatedServer.name, description: updatedServer.description } });

    return {
        _id: updatedServer._id,
        name: updatedServer.name,
        description: updatedServer.description
    };
};

export const getServerInfo = async ({ serverId, userId }) => {
    const server = await serverRepo.findServerWithPopulatedUsers(serverId);
    if (!server) {
        throw new ApiError(404, "Server not found");
    }

    const activeBan = await serverRepo.findActiveBan(serverId, userId);
    if (activeBan) throw new ApiError(403, "You are temporarily banned from this server");
    const cached = await getCached(cacheKeys.server(serverId, userId));
    if (cached) return cached;
    const isOwner = server.owner._id.toString() === userId.toString();
    const isModerator = server.moderators.some(
        (mod) => mod._id.toString() === userId.toString()
    );
    const isMember = server.members.some(
        (member) => member._id.toString() === userId.toString()
    );

    if (!isMember && !isModerator && !isOwner) {
        throw new ApiError(403, "You are not part of this server");
    }

    const channels = await serverRepo.findChannelsByServerId(serverId);

    const result = {
        _id: server._id,
        name: server.name,
        description: server.description,
        role: getServerRole(server, userId),
        owner: { _id: server.owner._id, username: server.owner.username },
        moderators: server.moderators.filter((m) => m._id.toString() !== server.owner._id.toString()).map((m) => ({ _id: m._id, username: m.username })),
        members: server.members.filter((m) => m._id.toString() !== server.owner._id.toString() && !server.moderators.some((mod) => mod._id.toString() === m._id.toString())).map((m) => ({ _id: m._id, username: m.username })),
        channels
    };
    await setCached(cacheKeys.server(serverId, userId), result, 15);
    return result;
};

export const joinServer = async ({ serverId, userId, inviteCode }) => {
    const server = await serverRepo.findServerById(serverId);
    if (!server) {
        throw new ApiError(404, "Server not found");
    }

    const invite = await Invite.findOne({ server: serverId, code: inviteCode, revokedAt: null });
    const now = new Date();
    if (!invite || (invite.expiresAt && invite.expiresAt <= now) || (invite.maxUses && invite.uses >= invite.maxUses)) {
        throw new ApiError(403, "Invalid or expired invite link");
    }

    const isAlreadyMember =
        server.owner.toString() === userId.toString() ||
        server.moderators.some((modId) => modId.toString() === userId.toString()) ||
        server.members.some((memberId) => memberId.toString() === userId.toString());

    if (isAlreadyMember) {
        throw new ApiError(400, "You are already part of this server");
    }

    // Reserve a use atomically so parallel joins cannot exceed maxUses.
    const reservedInvite = await Invite.findOneAndUpdate(
        { _id: invite._id, $expr: { $or: [{ $eq: ["$maxUses", null] }, { $lt: ["$uses", "$maxUses"] }] } },
        { $inc: { uses: 1 } }, { new: true }
    );
    if (!reservedInvite) throw new ApiError(403, "Invite has reached its maximum uses");
    const updated = await serverRepo.addMemberToServer(serverId, userId);
    await deleteCached(cacheKeys.servers(userId), cacheKeys.server(serverId, userId));
    await audit(serverId, userId, "member.joined", { metadata: { inviteId: invite._id.toString() } });

    // 📢 Fire domain event — realtime layer decides what to do with it
    eventBus.emit(EVENTS.SERVER_MEMBER_JOINED, { serverId, userId });

    return {
        _id: updated._id,
        name: updated.name
    };
};

export const createInvite = async ({ serverId, userId, expiresInHours, maxUses }) => {
  const server = await serverRepo.findServerById(serverId);
  if (!server) throw new ApiError(404, "Server not found");
  assertModerator(server, userId);
  const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000) : null;
  const invite = await Invite.create({ server: serverId, createdBy: userId, expiresAt, maxUses: maxUses || null });
  await audit(serverId, userId, "invite.created", { targetId: invite._id.toString(), metadata: { expiresAt, maxUses: invite.maxUses } });
  return invite;
};

export const listInvites = async ({ serverId, userId }) => {
  const server = await serverRepo.findServerById(serverId);
  if (!server) throw new ApiError(404, "Server not found");
  assertModerator(server, userId);
  return Invite.find({ server: serverId }).sort({ createdAt: -1 }).lean();
};

export const revokeInvite = async ({ serverId, inviteId, userId }) => {
  const server = await serverRepo.findServerById(serverId);
  if (!server) throw new ApiError(404, "Server not found");
  assertModerator(server, userId);
  const invite = await Invite.findOneAndUpdate({ _id: inviteId, server: serverId, revokedAt: null }, { $set: { revokedAt: new Date() } }, { new: true });
  if (!invite) throw new ApiError(404, "Active invite not found");
  await audit(serverId, userId, "invite.revoked", { targetId: inviteId });
  return invite;
};

export const setMemberRole = async ({ serverId, memberId, role, userId }) => {
  const server = await serverRepo.findServerById(serverId);
  if (!server) throw new ApiError(404, "Server not found");
  assertOwner(server, userId);
  if (server.owner.toString() === memberId) throw new ApiError(400, "The owner role cannot be changed");
  const isMember = server.members.some((id) => id.toString() === memberId);
  if (!isMember) throw new ApiError(404, "Member not found");
  if (role === "moderator") await serverRepo.addModerator(serverId, memberId);
  else await serverRepo.removeModerator(serverId, memberId);
  await deleteCached(cacheKeys.server(serverId, userId), cacheKeys.server(serverId, memberId), cacheKeys.servers(memberId));
  await audit(serverId, userId, role === "moderator" ? "member.promoted" : "member.demoted", { targetUser: memberId });
  return true;
};

export const removeMember = async ({ serverId, memberId, userId }) => {
  const server = await serverRepo.findServerById(serverId);
  if (!server) throw new ApiError(404, "Server not found");
  assertModerator(server, userId);
  const targetRole = getServerRole(server, memberId);
  const actorRole = getServerRole(server, userId);
  if (!targetRole) throw new ApiError(404, "Member not found");
  if (targetRole === "owner" || (targetRole === "moderator" && actorRole !== "owner")) throw new ApiError(403, "You cannot remove this member");
  await serverRepo.removeMember(serverId, memberId);
  await deleteCached(cacheKeys.server(serverId, userId), cacheKeys.server(serverId, memberId), cacheKeys.servers(memberId));
  await audit(serverId, userId, "member.removed", { targetUser: memberId });
  return true;
};

export const listAuditLogs = async ({ serverId, userId }) => {
  const server = await serverRepo.findServerById(serverId);
  if (!server) throw new ApiError(404, "Server not found");
  assertModerator(server, userId);
  return AuditLog.find({ server: serverId }).sort({ createdAt: -1 }).limit(100).populate("actor targetUser", "username").lean();
};

const assertTargetCanBeModerated = (server, targetUserId) => {
  const role = getServerRole(server, targetUserId);
  if (!role) throw new ApiError(404, "Member not found");
  if (role === "owner") throw new ApiError(403, "The server owner cannot be moderated");
  return role;
};

export const warnMember = async ({ serverId, memberId, userId, reason }) => {
  const server = await serverRepo.findServerById(serverId);
  if (!server) throw new ApiError(404, "Server not found");
  assertModerator(server, userId);
  assertTargetCanBeModerated(server, memberId);
  const action = await serverRepo.createModerationAction({ server: serverId, targetUser: memberId, actor: userId, type: "warning", reason: reason?.trim() || "Moderation warning" });
  await Notification.create({ recipient: memberId, actor: userId, server: serverId, type: "moderation_warning", metadata: { reason: action.reason } });
  eventBus.emit(EVENTS.MODERATION_ACTION, { targetUserId: memberId.toString(), type: "moderation_warning", serverId: serverId.toString(), reason: action.reason });
  await audit(serverId, userId, "member.warned", { targetUser: memberId, metadata: { reason: action.reason, moderationActionId: action._id.toString() } });
  return action;
};

export const banMember = async ({ serverId, memberId, userId, durationMinutes, reason }) => {
  const server = await serverRepo.findServerById(serverId);
  if (!server) throw new ApiError(404, "Server not found");
  assertModerator(server, userId);
  const targetRole = assertTargetCanBeModerated(server, memberId);
  if (targetRole === "moderator" && getServerRole(server, userId) !== "owner") throw new ApiError(403, "Only the owner can ban a moderator");
  await serverRepo.revokeActiveBan(serverId, memberId);
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
  const action = await serverRepo.createModerationAction({ server: serverId, targetUser: memberId, actor: userId, type: "temporary_ban", reason: reason?.trim() || "Temporary moderation ban", expiresAt });
  await Notification.create({ recipient: memberId, actor: userId, server: serverId, type: "moderation_ban", metadata: { reason: action.reason, expiresAt } });
  eventBus.emit(EVENTS.MODERATION_ACTION, { targetUserId: memberId.toString(), type: "moderation_ban", serverId: serverId.toString(), reason: action.reason, expiresAt });
  await deleteCached(cacheKeys.server(serverId, memberId), cacheKeys.servers(memberId));
  await audit(serverId, userId, "member.temp_banned", { targetUser: memberId, metadata: { expiresAt, reason: action.reason, moderationActionId: action._id.toString() } });
  return action;
};

export const unbanMember = async ({ serverId, memberId, userId }) => {
  const server = await serverRepo.findServerById(serverId);
  if (!server) throw new ApiError(404, "Server not found");
  assertModerator(server, userId);
  assertTargetCanBeModerated(server, memberId);
  const action = await serverRepo.revokeActiveBan(serverId, memberId);
  if (!action) throw new ApiError(404, "Active temporary ban not found");
  await audit(serverId, userId, "member.unbanned", { targetUser: memberId, metadata: { moderationActionId: action._id.toString() } });
  await deleteCached(cacheKeys.server(serverId, memberId), cacheKeys.servers(memberId));
  return action;
};

export const listModerationActions = async ({ serverId, userId }) => {
  const server = await serverRepo.findServerById(serverId);
  if (!server) throw new ApiError(404, "Server not found");
  assertModerator(server, userId);
  return serverRepo.listModerationActions(serverId);
};



export const getServerRoomIds = async (userId) => {
    return await serverRepo.findServerIdsForUser(userId);
};
