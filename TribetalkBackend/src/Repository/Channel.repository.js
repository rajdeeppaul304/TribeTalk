//Channel.repository.js
import { Channel } from "../Models/Channel.model.js";
import { Server } from "../Models/Server.model.js";

export const findServerById = async (serverId) => {
    return await Server.findById(serverId);
};

export const findChannelByIdWithServer = async (channelId) => {
    return await Channel.findById(channelId).populate("server");
};

export const findChannelById = async (channelId) => {
    return await Channel.findById(channelId);
};

export const createChannelDoc = async (channelData) => {
    return await Channel.create(channelData);
};

export const deleteChannelDoc = async (channelId) => {
    return await Channel.findByIdAndDelete(channelId);
};

export const saveChannelDoc = async (channelDoc) => {
    return await channelDoc.save();
};

export const isUserInServerMembers = async (serverId, userId) => {
    return await Server.exists({
        _id: serverId,
        members: userId
    });
};