import { Notification } from "../Models/Notification.model.js";
import { Channel } from "../Models/Channel.model.js";
import { Server } from "../Models/Server.model.js";
import { User } from "../Models/User.model.js";

const mentionedUsernames = (content) => [...new Set((content.match(/@([a-zA-Z0-9_]{3,30})/g) || []).map((value) => value.slice(1).toLowerCase()))];

export const createMessageNotifications = async ({ message, senderId }) => {
  const channel = await Channel.findById(message.channel).select("server").lean();
  if (!channel) return [];
  const server = await Server.findById(channel.server).select("owner moderators members").lean();
  if (!server) return [];
  const memberIds = [...new Set([server.owner, ...server.moderators, ...server.members].map((id) => id.toString()))].filter((id) => id !== senderId.toString());
  if (!memberIds.length) return [];
  const users = await User.find({ _id: { $in: memberIds } }).select("username notificationPreferences").lean();
  const names = mentionedUsernames(message.content);
  const rows = users.flatMap((user) => {
    const isMention = names.includes(user.username);
    const preferences = user.notificationPreferences || {};
    if (isMention && preferences.mentions !== false) return [{ recipient: user._id, actor: senderId, server: channel.server, channel: message.channel, message: message._id, type: "mention" }];
    if (!isMention && preferences.unread !== false) return [{ recipient: user._id, actor: senderId, server: channel.server, channel: message.channel, message: message._id, type: "unread" }];
    return [];
  });
  if (!rows.length) return [];
  const created = await Notification.insertMany(rows, { ordered: false });
  return created.map((notification) => ({ ...notification.toObject(), recipient: notification.recipient.toString(), type: notification.type, channelId: message.channel.toString(), messageId: message._id.toString() }));
};

export const listNotifications = (userId) => Notification.find({ recipient: userId }).sort({ createdAt: -1 }).limit(100).populate("actor", "username avatar").lean();
export const markNotificationsRead = (userId, ids = []) => Notification.updateMany({ recipient: userId, ...(ids.length ? { _id: { $in: ids } } : {}) }, { $set: { readAt: new Date() } });
