import { Message } from "../Models/Message.model.js";
import { Channel } from "../Models/Channel.model.js";
import { ReadState } from "../Models/ReadState.model.js";

/**
 * Create message and auto-increment channel sequence
 */
export const createMessage = async ({ content, sender, channel, clientId = null, isSystemMessage = false, attachments = [], replyTo = null, threadRoot = null }) => {
  if (clientId) {
    const existing = await Message.findOne({ channel, sender, clientId }).populate("sender", "username displayName avatar");
    if (existing) return existing;
  }
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

  let message;
  try {
    message = await Message.create({ content, sender, channel, sequence: updatedChannel.messageSequence, clientId, isSystemMessage, attachments, replyTo, threadRoot });
  } catch (error) {
    // A concurrent retry won the unique client-id race. Return its canonical message.
    if (error?.code === 11000 && clientId) {
      return Message.findOne({ channel, sender, clientId }).populate("sender", "username displayName avatar");
    }
    throw error;
  }

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
    const beforeMsg = await Message.findOne({ _id: before, channel: channelId }).select("sequence").lean();
    if (beforeMsg) {
      query.sequence = { $lt: beforeMsg.sequence };
    }
  } else if (after) {
    const afterMsg = await Message.findOne({ _id: after, channel: channelId }).select("sequence").lean();
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

  if (before || after) {
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

export const getThreadMessages = async (channelId, rootId) => Message.find({
  channel: channelId,
  $or: [{ _id: rootId }, { threadRoot: rootId }],
  deletedAt: null,
}).sort({ sequence: 1 }).populate("sender", "username avatar").lean();

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
  return await Message.findById(messageId).select("channel sender deletedAt").lean();
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
export const softDeleteMessage = async (messageId) => {
  return await Message.findOneAndUpdate(
    { _id: messageId, deletedAt: null },
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
