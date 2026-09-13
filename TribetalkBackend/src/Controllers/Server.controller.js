//Server.controller.js

import mongoose from "mongoose";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import * as serverService from "../Service/Server.service.js";

export const createServer = asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    const ownerId = req.user._id;

    if (!name || name.trim().length < 3) {
        throw new ApiError(400, "Server name must be at least 3 characters long");
    }

    const server = await serverService.createServer({
        name,
        description,
        ownerId
    });

    return res.status(201).json(
        new ApiResponse(201, server, "Server created successfully")
    );
});

export const deleteServer = asyncHandler(async (req, res) => {
    const serverId = req.params.id;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(serverId)) {
        throw new ApiError(400, "Invalid server ID");
    }

    await serverService.deleteServer({ serverId, userId });

    return res.status(200).json(
        new ApiResponse(200, null, "Server deleted successfully")
    );
});

export const listServers = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const serversWithRole = await serverService.listServers(userId);

    return res.status(200).json(
        new ApiResponse(200, serversWithRole, "Servers fetched successfully")
    );
});

export const editServer = asyncHandler(async (req, res) => {
    const serverId = req.params.id;
    const { name, description } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(serverId)) {
        throw new ApiError(400, "Invalid server ID");
    }

    if (name && name.trim().length < 3) {
        throw new ApiError(400, "Server name must be at least 3 characters long");
    }

    const updatedServer = await serverService.editServer({
        serverId,
        name,
        description,
        userId
    });

    return res.status(200).json(
        new ApiResponse(200, updatedServer, "Server updated successfully")
    );
});

export const getServerInfo = asyncHandler(async (req, res) => {
    const serverId = req.params.id;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(serverId)) {
        throw new ApiError(400, "Invalid server ID");
    }

    const serverInfo = await serverService.getServerInfo({ serverId, userId });

    return res.status(200).json(
        new ApiResponse(200, serverInfo, "Server info fetched successfully")
    );
});

export const joinServer = asyncHandler(async (req, res) => {
    const serverId = req.params.id;
    const userId = req.user._id;
    const { inviteCode } = req.body;

    if (!mongoose.Types.ObjectId.isValid(serverId)) {
        throw new ApiError(400, "Invalid server ID");
    }

    const joinedServer = await serverService.joinServer({ serverId, userId, inviteCode });

    return res.status(200).json(
        new ApiResponse(200, joinedServer, "Joined server successfully")
    );
});

export const createInvite = asyncHandler(async (req, res) => {
    const invite = await serverService.createInvite({ serverId: req.params.id, userId: req.user._id, ...req.body });
    return res.status(201).json(new ApiResponse(201, invite, "Invite created"));
});
export const listInvites = asyncHandler(async (req, res) => {
    const invites = await serverService.listInvites({ serverId: req.params.id, userId: req.user._id });
    return res.json(new ApiResponse(200, invites, "Invites retrieved"));
});
export const revokeInvite = asyncHandler(async (req, res) => {
    const invite = await serverService.revokeInvite({ serverId: req.params.id, inviteId: req.params.inviteId, userId: req.user._id });
    return res.json(new ApiResponse(200, invite, "Invite revoked"));
});
export const setMemberRole = asyncHandler(async (req, res) => {
    await serverService.setMemberRole({ serverId: req.params.id, memberId: req.params.memberId, role: req.body.role, userId: req.user._id });
    return res.json(new ApiResponse(200, null, "Member role updated"));
});
export const removeMember = asyncHandler(async (req, res) => {
    await serverService.removeMember({ serverId: req.params.id, memberId: req.params.memberId, userId: req.user._id });
    return res.json(new ApiResponse(200, null, "Member removed"));
});
export const listAuditLogs = asyncHandler(async (req, res) => {
    const logs = await serverService.listAuditLogs({ serverId: req.params.id, userId: req.user._id });
    return res.json(new ApiResponse(200, logs, "Audit log retrieved"));
});
