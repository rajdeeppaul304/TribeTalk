import { Message } from "../Models/Message.model.js";
import { Channel } from "../Models/Channel.model.js";
import { ReadState } from "../Models/ReadState.model.js";

/**
 * Create message and auto-increment channel sequence
 */
export const createMessage = async ({ content, sender, channel, clientId = null, isSystemMessage = false }) => {
  const updatedChannel = await Channel.findByIdAndUpdate(
    channel,
    { 
      $inc: { messageSequence: 1 },
      lastMessageAt: new Date()
    },
    { new: true }
  );

  if (!updatedChannel) {
    return null;
  }

  const message = await Message.create({
    content,
    sender,
    channel,
    sequence: updatedChannel.messageSequence,
    clientId,
    isSystemMessage
  });

  await Channel.findOneAndUpdate(
    {
      _id: channel,
      $or: [
        { lastMessageSequence: { $lt: message.sequence } },
        { lastMessageSequence: { $exists: false } }
      ]
    },
    {
      $set: {
        lastMessageId: message._id,
        lastMessageSequence: message.sequence,
        lastMessageAt: message.createdAt
      }
    }
  );

  return message;
};

/**
 * Fetch messages by cursor (before / after sequence)
 */
export const getMessages = async ({ channelId, limit = 50, before = null, after = null }) => {
  const query = { 
    channel: channelId,
    deletedAt: null
  };

  let sortOrder = -1;

  if (before) {
    const beforeMsg = await Message.findById(before).select("sequence").lean();
    if (beforeMsg) {
      query.sequence = { $lt: beforeMsg.sequence };
    }
  } else if (after) {
    const afterMsg = await Message.findById(after).select("sequence").lean();
    if (afterMsg) {
      query.sequence = { $gt: afterMsg.sequence };
      sortOrder = 1;
    }
  }

  const messages = await Message.find(query)
    .sort({ sequence: sortOrder })
    .limit(Math.min(limit, 100))
    .populate("sender", "username avatar")
    .lean();

  if (after) {
    messages.reverse();
  }

  return messages;
};

/**
 * Fetch missed messages since sequence
 */
export const getMessagesSinceSequence = async (channelId, sinceSequence) => {
  return await Message.find({
    channel: channelId,
    sequence: { $gt: sinceSequence },
    deletedAt: null
  })
    .sort({ sequence: 1 })
    .populate("sender", "username avatar")
    .lean();
};

/**
 * Find message by ID (active only)
 */
// export const findMessageById = async (messageId) => {
//   return await Message.findOne({ _id: messageId, deletedAt: null });
// };

export const findMessageByIdAndChannel = async (messageId, channelId) => {
  return await Message.findOne({ 
    _id: messageId, 
    channel: channelId, 
    deletedAt: null 
  });
};

export const findMessageById = async (messageId) => {
  return await Message.findById(messageId).select("channel deletedAt").lean();
};

export const deleteMessagesAndReadStatesForChannels = async (channelIds) => {
  if (channelIds.length === 0) return;
  await Promise.all([
    Message.deleteMany({ channel: { $in: channelIds } }),
    ReadState.deleteMany({ channel: { $in: channelIds } })
  ]);
};

/**
 * Update message content by author
 */
export const updateMessageContent = async (messageId, userId, content) => {
  return await Message.findOneAndUpdate(
    { _id: messageId, sender: userId, deletedAt: null },
    { 
      $set: { 
        content,
        isEdited: true,
        editedAt: new Date()
      }
    },
    { new: true }
  ).populate("sender", "username avatar");
};

/**
 * Soft delete message by author
 */
export const softDeleteMessage = async (messageId, userId) => {
  return await Message.findOneAndUpdate(
    { _id: messageId, sender: userId, deletedAt: null },
    { 
      $set: { 
        deletedAt: new Date(),
        content: "[Message deleted]"
      }
    },
    { new: true }
  ).populate("sender", "username avatar");
};

/**
 * Get latest message in a channel
 */
export const getLatestMessage = async (channelId) => {
  return await Message.findOne({ channel: channelId, deletedAt: null })
    .sort({ sequence: -1 })
    .lean();
};

/**
 * Count unread messages beyond sequence
 */
export const countUnreadMessages = async (channelId, lastReadSequence) => {
  return await Message.countDocuments({
    channel: channelId,
    sequence: { $gt: lastReadSequence },
    deletedAt: null
  });
};

// ============================================
// READ STATE OPERATIONS (Moved to Repository)
// ============================================

export const upsertReadState = async (userId, channelId, messageId, sequence) => {
  return await ReadState.findOneAndUpdate(
    { user: userId, channel: channelId },
    {
      $set: {
        lastReadMessageId: messageId,
        lastReadSequence: sequence,
        lastReadAt: new Date()
      }
    },
    { upsert: true, new: true }
  );
};

export const findReadState = async (userId, channelId) => {
  return await ReadState.findOne({ user: userId, channel: channelId }).lean();
};

export const findAllUserReadStates = async (userId) => {
  return await ReadState.find({ user: userId }).lean();
};
