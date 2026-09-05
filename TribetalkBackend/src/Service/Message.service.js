import * as messageRepo from "../Repository/Message.repository.js";
import { checkChannelAccess } from "./Permission.service.js";
import { ApiError } from "../Utils/ApiError.js";

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
export const addMessage = async ({ content, channelId, UserId, clientId = null, isSystemMessage = false }) => {
  if (!content?.trim() && !isSystemMessage) {
    throw new ApiError(400, "Message content cannot be empty");
  }

  if (!UserId || !channelId) {
    throw new ApiError(400, "UserId and ChannelId are required");
  }

  // ✅ Domain-level membership verification
  await assertChannelAccess(UserId, channelId);

  const savedMessage = await messageRepo.createMessage({
    content: content?.trim() || "",
    sender: UserId,
    channel: channelId,
    clientId,
    isSystemMessage
  });

  if (!savedMessage) {
    throw new ApiError(404, "Channel not found");
  }

  return savedMessage;
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

/**
 * Edit a message
 */
export const editMessage = async (messageId, content, userId) => {
  if (!content?.trim()) {
    throw new ApiError(400, "Message content cannot be empty");
  }

  const updatedMessage = await messageRepo.updateMessageContent(messageId, userId, content.trim());

  if (!updatedMessage) {
    throw new ApiError(404, "Message not found or you do not have permission to edit it");
  }

  return updatedMessage;
};

/**
 * Delete a message
 */
export const deleteMessage = async (messageId, userId) => {
  const deletedMessage = await messageRepo.softDeleteMessage(messageId, userId);

  if (!deletedMessage) {
    throw new ApiError(404, "Message not found or you do not have permission to delete it");
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
  const readStates = await messageRepo.findAllUserReadStates(userId);
  const unreadCounts = {};

  await Promise.all(
    readStates.map(async (state) => {
      const channelId = state.channel?.toString();
      if (channelId) {
        const count = await messageRepo.countUnreadMessages(channelId, state.lastReadSequence || 0);
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