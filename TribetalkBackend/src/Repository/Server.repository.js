//Server.repository.js
import { Server } from "../Models/Server.model.js";
import { Channel } from "../Models/Channel.model.js";
import { Message } from "../Models/Message.model.js";
import { ReadState } from "../Models/ReadState.model.js";
import { ModerationAction } from "../Models/ModerationAction.model.js";
import { Invite } from "../Models/Invite.model.js";
import { AuditLog } from "../Models/AuditLog.model.js";

export const findServerByNameAndOwner = async (name, ownerId) => {
    return await Server.findOne({ name, owner: ownerId });
};

export const createServerDoc = async (data) => {
    return await Server.create(data);
};

export const findServerById = async (serverId) => {
    return await Server.findById(serverId);
};

export const deleteServerById = async (serverId) => {
    const channelIds = await Channel.find({ server: serverId }).distinct("_id");
    await Promise.all([
        Message.deleteMany({ channel: { $in: channelIds } }),
        ReadState.deleteMany({ channel: { $in: channelIds } }),
        Channel.deleteMany({ server: serverId }),
        Invite.deleteMany({ server: serverId }),
        ModerationAction.deleteMany({ server: serverId }),
        AuditLog.deleteMany({ server: serverId })
    ]);
    return await Server.findByIdAndDelete(serverId);
};

export const findServersForUser = async (userId) => {
    const bannedServerIds = await ModerationAction.distinct("server", { targetUser: userId, type: "temporary_ban", revokedAt: null, expiresAt: { $gt: new Date() } });
    return await Server.find({
        _id: { $nin: bannedServerIds },
        $or: [
            { owner: userId },
            { moderators: userId },
            { members: userId }
        ]
    })
        .select("name _id description owner moderators members inviteCode")
        .sort({ createdAt: -1 })
        .lean();
};

export const saveServerDoc = async (serverDoc) => {
    return await serverDoc.save();
};

export const findServerWithPopulatedUsers = async (serverId) => {
    return await Server.findById(serverId)
        .populate("owner", "username")
        .populate("moderators", "username")
        .populate("members", "username");
};

export const findChannelsByServerId = async (serverId) => {
    return await Channel.find({ server: serverId })
        .select("_id name type description")
        .sort({ createdAt: 1 })
        .lean();
};

export const addMemberToServer = async (serverId, userId) => {
    return await Server.findByIdAndUpdate(
        serverId,
        { $addToSet: { members: userId } },
        { new: true }
    );
};

export const saveServerInviteCode = async (serverId, inviteCode) => {
    return await Server.findByIdAndUpdate(
        serverId,
        { $set: { inviteCode } },
        { new: true }
    );
};

export const addModerator = async (serverId, userId) => Server.findByIdAndUpdate(serverId, { $addToSet: { moderators: userId, members: userId } }, { new: true });
export const removeModerator = async (serverId, userId) => Server.findByIdAndUpdate(serverId, { $pull: { moderators: userId } }, { new: true });
export const removeMember = async (serverId, userId) => Server.findByIdAndUpdate(serverId, { $pull: { members: userId, moderators: userId } }, { new: true });


/**
 * Find all channel IDs across servers where the user is an owner, moderator, or member
 */
export const findUserAccessibleChannelIds = async (userId) => {
    const bannedServerIds = await ModerationAction.distinct("server", { targetUser: userId, type: "temporary_ban", revokedAt: null, expiresAt: { $gt: new Date() } });
    const servers = await Server.find({
        _id: { $nin: bannedServerIds },
        $or: [
            { owner: userId },
            { moderators: userId },
            { members: userId }
        ]
    })
        .select("_id")
        .lean();

    const serverIds = servers.map((s) => s._id);
    if (serverIds.length === 0) return [];

    const channels = await Channel.find({ server: { $in: serverIds } })
        .select("_id")
        .lean();

    return channels.map((c) => c._id.toString());
};


export const findServerIdsForUser = async (userId) => {
    const bannedServerIds = await ModerationAction.distinct("server", { targetUser: userId, type: "temporary_ban", revokedAt: null, expiresAt: { $gt: new Date() } });
    const servers = await Server.find({
        _id: { $nin: bannedServerIds },
        $or: [
            { owner: userId },
            { moderators: userId },
            { members: userId }
        ]
    })
        .select("_id")
        .lean();

    return servers.map((s) => s._id.toString());
};

export const listModerationActions = (serverId) => ModerationAction.find({ server: serverId }).sort({ createdAt: -1 }).limit(200).populate("actor targetUser", "username displayName").lean();
export const createModerationAction = (data) => ModerationAction.create(data);
export const findActiveBan = (serverId, userId) => ModerationAction.findOne({ server: serverId, targetUser: userId, type: "temporary_ban", revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ expiresAt: -1 }).lean();
export const revokeActiveBan = (serverId, userId) => ModerationAction.findOneAndUpdate({ server: serverId, targetUser: userId, type: "temporary_ban", revokedAt: null, expiresAt: { $gt: new Date() } }, { $set: { revokedAt: new Date() } }, { new: true });
