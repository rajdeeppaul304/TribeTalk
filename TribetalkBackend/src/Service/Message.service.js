//Message.service.js
import * as messageRepo from "../Repository/Message.repository.js";
import { checkChannelAccess } from "./Permission.service.js";
import { ApiError } from "../Utils/ApiError.js";
import { findUserAccessibleChannelIds } from "../Repository/Server.repository.js";
import { indexMessage, removeMessageFromIndex } from "./Search.service.js";
import { Channel } from "../Models/Channel.model.js";
import { Server } from "../Models/Server.model.js";
import { canModerate } from "./Permission.service.js";
import { AuditLog } from "../Models/AuditLog.model.js";
import { Message } from "../Models/Message.model.js";

/**
 * Internal guard for domain-level authorization
 */
const assertChannelAccess = async (userId, channelId) => {
  const hasAccess = await checkChannelAccess(userId, channelId);
  if (!hasAccess) {
    throw new ApiError(403, "You do not have permission to access this channel");
  }
};

/**
 * Add a new message (Guarded)
 */
export const addMessage = async ({ content, channelId, UserId, clientId = null, isSystemMessage = false, attachments = [], replyTo = null }) => {
  if (!content?.trim() && attachments.length === 0 && !isSystemMessage) {
    throw new ApiError(400, "Message content or an attachment is required");
  }

  if (!UserId || !channelId) {
    throw new ApiError(400, "UserId and ChannelId are required");
  }

  // ✅ Domain-level membership verification
  await assertChannelAccess(UserId, channelId);

  let threadRoot = null;
  if (replyTo) {
    const parent = await Message.findOne({ _id: replyTo, channel: channelId, deletedAt: null }).select("threadRoot").lean();
    if (!parent) throw new ApiError(404, "The message you replied to was not found in this channel");
    threadRoot = parent.threadRoot || parent._id;
  }
  const savedMessage = await messageRepo.createMessage({
    content: content?.trim() || "",
    sender: UserId,
    channel: channelId,
    clientId,
    isSystemMessage,
    attachments,
    replyTo,
    threadRoot,
  });

  if (!savedMessage) {
    throw new ApiError(404, "Channel not found");
  }

  await savedMessage.populate("sender", "username displayName avatar");
  void indexMessage(savedMessage);

  return savedMessage;
};

export const toggleReaction = async ({ messageId, emoji, userId }) => {
  const message = await Message.findById(messageId);
  if (!message || message.deletedAt) throw new ApiError(404, "Message not found");
  await assertChannelAccess(userId, message.channel);
  const reaction = message.reactions.find((item) => item.emoji === emoji);
  const alreadyReacted = reaction?.users.some((id) => id.toString() === userId.toString());
  if (reaction && alreadyReacted) reaction.users.pull(userId);
  else if (reaction) reaction.users.addToSet(userId);
  else message.reactions.push({ emoji, users: [userId] });
  message.reactions = message.reactions.filter((item) => item.users.length > 0);
  await message.save();
  await message.populate("sender", "username displayName avatar");
  return message;
};

export const togglePin = async ({ messageId, userId }) => {
  const message = await Message.findById(messageId);
  if (!message || message.deletedAt) throw new ApiError(404, "Message not found");
  const channel = await Channel.findById(message.channel).select("server").lean();
  const server = channel && await Server.findById(channel.server).select("owner moderators members").lean();
  if (!server || !canModerate(server, userId)) throw new ApiError(403, "Owner or moderator permission required to pin messages");
  const pinned = !message.pinnedAt;
  message.pinnedAt = pinned ? new Date() : null;
  message.pinnedBy = pinned ? userId : null;
  await message.save();
  await message.populate("sender", "username displayName avatar");
  void AuditLog.create({ server: server._id, actor: userId, action: pinned ? "message.pinned" : "message.unpinned", targetId: messageId });
  return message;
};

/**
 * Get message history with cursor pagination (Guarded)
 */
export const getMessageHistory = async ({ channelId, limit = 50, before = null, after = null, userId = null }) => {
  if (userId) {
    await assertChannelAccess(userId, channelId);
  }
  return await messageRepo.getMessages({ channelId, limit, before, after });
};

/**
 * Get messages since a specific sequence (for reconnect/sync)
 */
export const getMissedMessages = async (channelId, sinceSequence, userId = null) => {
  if (userId) {
    await assertChannelAccess(userId, channelId);
  }
  return await messageRepo.getMessagesSinceSequence(channelId, sinceSequence);
};

export const getThread = async ({ channelId, rootId, userId }) => {
  await assertChannelAccess(userId, channelId);
  const root = await Message.findOne({ _id: rootId, channel: channelId }).select("threadRoot").lean();
  if (!root) throw new ApiError(404, "Thread not found");
  return messageRepo.getThreadMessages(channelId, root.threadRoot || root._id);
};

/**
 * Edit a message
 */
export const editMessage = async (messageId, content, userId) => {
  if (!content?.trim()) {
    throw new ApiError(400, "Message content cannot be empty");
  }

  const message = await messageRepo.findMessageById(messageId);
  if (!message || message.deletedAt) {
    throw new ApiError(404, "Message not found");
  }
  await assertChannelAccess(userId, message.channel);

  const updatedMessage = await messageRepo.updateMessageContent(messageId, userId, content.trim());

  if (!updatedMessage) {
    throw new ApiError(404, "Message not found or you do not have permission to edit it");
  }

  void indexMessage(updatedMessage);

  return updatedMessage;
};

/**
 * Delete a message
 */
export const deleteMessage = async (messageId, userId) => {
  const message = await messageRepo.findMessageById(messageId);
  if (!message || message.deletedAt) {
    throw new ApiError(404, "Message not found");
  }
  await assertChannelAccess(userId, message.channel);
  const channel = await Channel.findById(message.channel).select("server").lean();
  const server = channel ? await Server.findById(channel.server).select("owner moderators members").lean() : null;
  const isAuthor = message.sender?.toString() === userId.toString();
  const isModerator = server && canModerate(server, userId);
  if (!isAuthor && !isModerator) {
    throw new ApiError(403, "Only the author or a server moderator can delete this message");
  }

  const deletedMessage = await messageRepo.softDeleteMessage(messageId);

  if (!deletedMessage) {
    throw new ApiError(404, "Message not found or you do not have permission to delete it");
  }

  void removeMessageFromIndex(deletedMessage._id);
  if (!isAuthor && server) {
    void AuditLog.create({ server: server._id, actor: userId, action: "message.removed", targetId: messageId, metadata: { channelId: message.channel.toString() } });
  }

  return deletedMessage;
};

/**
 * Mark messages as read (Guarded)
 */
export const markAsRead = async (userId, channelId, lastReadMessageId = null) => {
  await assertChannelAccess(userId, channelId);

  let targetMessage = null;

  if (lastReadMessageId) {
    targetMessage = await messageRepo.findMessageByIdAndChannel(lastReadMessageId, channelId);
    if (!targetMessage) {
      throw new ApiError(404, "Target message not found");
    }
  } else {
    targetMessage = await messageRepo.getLatestMessage(channelId);
  }

  if (!targetMessage) {
    return null;
  }

  const currentReadState = await messageRepo.findReadState(userId, channelId);
  if (currentReadState && currentReadState.lastReadSequence >= targetMessage.sequence) {
    return currentReadState; // Already read up to or past this sequence, no DB write needed
  }

  return await messageRepo.upsertReadState(
    userId,
    channelId,
    targetMessage._id,
    targetMessage.sequence
  );
};

/**
 * Get unread count for a single channel (Guarded)
 */
export const getUnreadCount = async (userId, channelId) => {
  await assertChannelAccess(userId, channelId);
  const readState = await messageRepo.findReadState(userId, channelId);
  const lastReadSequence = readState?.lastReadSequence || 0;

  return await messageRepo.countUnreadMessages(channelId, lastReadSequence);
};

/**
 * Get map of unread counts for all user channels
 */
export const getUnreadCountsForUser = async (userId) => {
  const [channelIds, readStates] = await Promise.all([
    findUserAccessibleChannelIds(userId),
    messageRepo.findAllUserReadStates(userId)
  ]);

  const readStateMap = new Map();
  for (const state of readStates) {
    if (state.channel) {
      readStateMap.set(state.channel.toString(), state.lastReadSequence || 0);
    }
  }

  const unreadCounts = {};

  await Promise.all(
    channelIds.map(async (channelId) => {
      const lastReadSeq = readStateMap.get(channelId) ?? 0;
      const count = await messageRepo.countUnreadMessages(channelId, lastReadSeq);
      if (count > 0) {
        unreadCounts[channelId] = count;
      }
    })
  );

  return unreadCounts;
};

/**
 * Get read state for a user in a channel
 */
export const getReadState = async (userId, channelId) => {
  return await messageRepo.findReadState(userId, channelId);
};

/**
 * Get channel sync data (Guarded)
 */
export const getChannelSyncData = async (userId, channelId) => {
  await assertChannelAccess(userId, channelId);

  const [latestMessage, readState] = await Promise.all([
    messageRepo.getLatestMessage(channelId),
    messageRepo.findReadState(userId, channelId)
  ]);

  const lastReadSequence = readState?.lastReadSequence || 0;
  const unreadCount = await messageRepo.countUnreadMessages(channelId, lastReadSequence);

  return {
    latestMessageId: latestMessage?._id || null,
    latestSequence: latestMessage?.sequence || 0,
    lastReadSequence,
    unreadCount
  };
};
