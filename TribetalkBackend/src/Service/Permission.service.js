// src/socket/PermissionService.js (or src/Service/Channel.service.js)
import { Channel } from "../Models/Channel.model.js";
import { Server } from "../Models/Server.model.js";

export const getServerRole = (server, userId) => {
  const id = userId.toString();
  if (server.owner.toString() === id) return "owner";
  if ((server.moderators || []).some((member) => member.toString() === id)) return "moderator";
  if ((server.members || []).some((member) => member.toString() === id)) return "member";
  return null;
};

export const canModerate = (server, userId) => ["owner", "moderator"].includes(getServerRole(server, userId));

export async function checkChannelAccess(userId, channelId) {
    try {
        if (!userId || !channelId) return false;

        // 1. Fetch channel and its parent server ID
        const channel = await Channel.findById(channelId).select("server").lean();
        if (!channel || !channel.server) return false;

        // 2. Check if user is the owner, a moderator, or a member of the server
        const hasAccess = await Server.exists({
            _id: channel.server,
            $or: [
                { owner: userId },
                { moderators: userId },
                { members: userId }
            ]
        });
        console.log("user has access to this channel")
        return Boolean(hasAccess);
    } catch (error) {
        console.error("❌ Error checking channel access:", error);
        return false;
    }
}
