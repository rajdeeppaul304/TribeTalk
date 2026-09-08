//Channel.service.js
import * as channelRepo from "../Repository/Channel.repository.js";
import { ApiError } from "../Utils/ApiError.js";
import { eventBus } from "../events/eventBus.js";
import { EVENTS } from "../events/eventNames.js";

// Internal helper for owner/moderator privileges
const assertCanManageChannel = (server, userId) => {
    const isAuthorized =
        server.owner.toString() === userId.toString() ||
        (server.moderators || []).some(
            (modId) => modId.toString() === userId.toString()
        );

    if (!isAuthorized) {
        throw new ApiError(403, "Only the server owner or moderators can perform this action");
    }
};

// Internal helper for read/membership privileges
const assertCanViewChannel = (server, userId) => {
    const isMember =
        server.owner.toString() === userId.toString() ||
        (server.moderators || []).some(
            (modId) => modId.toString() === userId.toString()
        ) ||
        (server.members || []).some(
            (memberId) => memberId.toString() === userId.toString()
        );

    if (!isMember) {
        throw new ApiError(403, "You must be a member of the server to view this channel");
    }
};

export const createChannel = async ({ name, serverId, description, userId }) => {
    const server = await channelRepo.findServerById(serverId);
    if (!server) {
        throw new ApiError(404, "Server not found");
    }

    assertCanManageChannel(server, userId);

    const newChannel = await channelRepo.createChannelDoc({
        name: name.trim().toLowerCase(),
        server: serverId,
        createdBy: userId,
        type: "text",
        description: description?.trim() || ""
    });

    // 📢 Fire internal domain event (Services stay pure, broadcasters handle the socket)
    eventBus.emit(EVENTS.CHANNEL_CREATED, {
        channel: newChannel,
        serverId: serverId.toString()
    });

    return newChannel;
};


export const deleteChannel = async ({ channelId, userId }) => {
    const channel = await channelRepo.findChannelByIdWithServer(channelId);
    if (!channel) {
        throw new ApiError(404, "Channel not found");
    }

    assertCanManageChannel(channel.server, userId);

    await channelRepo.deleteChannelDoc(channelId);
    return true;
};

export const editChannel = async ({ channelId, name, description, userId }) => {
    const channel = await channelRepo.findChannelByIdWithServer(channelId);
    if (!channel) {
        throw new ApiError(404, "Channel not found");
    }

    assertCanManageChannel(channel.server, userId);

    if (name) {
        channel.name = name.trim().toLowerCase();
    }

    if (description !== undefined) {
        channel.description = description.trim();
    }

    const updated = await channelRepo.saveChannelDoc(channel);

    return {
        _id: updated._id,
        name: updated.name,
        description: updated.description
    };
};

export const getChannelInfo = async ({ channelId, userId }) => {
    const channel = await channelRepo.findChannelByIdWithServer(channelId);
    if (!channel) {
        throw new ApiError(404, "Channel not found");
    }

    assertCanViewChannel(channel.server, userId);

    return channel;
};

export const userCanJoin = async ({ userId, serverId }) => {
    const exists = await channelRepo.isUserInServerMembers(serverId, userId);
    if (!exists) {
        throw new ApiError(403, "Join server first");
    }
    return true;
};

export const channelActivity = async ({ channelId }) => {
    const channel = await channelRepo.findChannelById(channelId);
    if (!channel) {
        throw new ApiError(404, "Channel not found");
    }
    return channel.server; // was: channel._id
};