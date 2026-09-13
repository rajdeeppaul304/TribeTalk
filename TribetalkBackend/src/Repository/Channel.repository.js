//Channel.repository.js
import { Channel } from "../Models/Channel.model.js";
import { Server } from "../Models/Server.model.js";
import { Message } from "../Models/Message.model.js";
import { ReadState } from "../Models/ReadState.model.js";

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
    await Promise.all([
        Message.deleteMany({ channel: channelId }),
        ReadState.deleteMany({ channel: channelId })
    ]);
    return await Channel.findByIdAndDelete(channelId);
};

export const findChannelIdsByServerId = async (serverId) => {
    const channels = await Channel.find({ server: serverId }).select("_id").lean();
    return channels.map((channel) => channel._id);
};

export const deleteChannelsByServerId = async (serverId) => {
    return await Channel.deleteMany({ server: serverId });
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
