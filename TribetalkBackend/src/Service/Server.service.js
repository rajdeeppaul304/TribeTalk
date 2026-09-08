//Server.service.js
import * as serverRepo from "../Repository/Server.repository.js";
import { ApiError } from "../Utils/ApiError.js";
import { eventBus } from "../events/eventBus.js";
import { EVENTS } from "../events/eventNames.js";


export const createServer = async ({ name, description, ownerId }) => {
    const trimmedName = name.trim();

    const existingServer = await serverRepo.findServerByNameAndOwner(trimmedName, ownerId);
    if (existingServer) {
        throw new ApiError(409, "You already have a server with this name");
    }

    return await serverRepo.createServerDoc({
        name: trimmedName,
        description: description?.trim() || "",
        owner: ownerId,
        moderators: [ownerId],
        members: [ownerId]
    });
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
    const servers = await serverRepo.findServersForUser(userId);

    return servers.map((server) => {
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
            role
        };
    });
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

    return {
        _id: server._id,
        name: server.name,
        description: server.description,
        owner: server.owner.username,
        moderators: server.moderators.map((m) => m.username),
        members: server.members.map((m) => m.username),
        channels
    };
};

export const joinServer = async ({ serverId, userId }) => {
    const server = await serverRepo.findServerById(serverId);
    if (!server) {
        throw new ApiError(404, "Server not found");
    }

    const isAlreadyMember =
        server.owner.toString() === userId.toString() ||
        server.moderators.some((modId) => modId.toString() === userId.toString()) ||
        server.members.some((memberId) => memberId.toString() === userId.toString());

    if (isAlreadyMember) {
        throw new ApiError(400, "You are already part of this server");
    }

    const updated = await serverRepo.addMemberToServer(serverId, userId);

    // 📢 Fire domain event — realtime layer decides what to do with it
    eventBus.emit(EVENTS.SERVER_MEMBER_JOINED, { serverId, userId });

    return {
        _id: updated._id,
        name: updated.name
    };
};



export const getServerRoomIds = async (userId) => {
    return await serverRepo.findServerIdsForUser(userId);
};