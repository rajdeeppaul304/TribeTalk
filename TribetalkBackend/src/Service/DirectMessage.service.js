import { Conversation } from "../Models/Conversation.model.js";
import { DirectMessage } from "../Models/DirectMessage.model.js";
import { User } from "../Models/User.model.js";
import { Notification } from "../Models/Notification.model.js";
import { ApiError } from "../Utils/ApiError.js";

const assertParticipant = async (conversationId, userId) => {
  const conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
  if (!conversation) throw new ApiError(403, "You are not a participant in this conversation");
  return conversation;
};

export const createConversation = async ({ userId, participantId }) => {
  if (userId.toString() === participantId.toString()) throw new ApiError(400, "You cannot message yourself");
  const participant = await User.findById(participantId).select("_id").lean();
  if (!participant) throw new ApiError(404, "User not found");
  const participants = [userId.toString(), participantId.toString()].sort();
  return Conversation.findOneAndUpdate(
    { participantKey: participants.join(":") },
    { $setOnInsert: { participants, participantKey: participants.join(":") } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).populate("participants", "username displayName avatar lastSeenAt").lean();
};

export const listConversations = (userId) => Conversation.find({ participants: userId }).sort({ lastMessageAt: -1, updatedAt: -1 }).populate("participants", "username displayName avatar lastSeenAt").lean();

export const listMessages = async ({ conversationId, userId, limit = 50, before }) => {
  await assertParticipant(conversationId, userId);
  const query = { conversation: conversationId };
  if (before) query.createdAt = { $lt: new Date(before) };
  return DirectMessage.find(query).sort({ createdAt: -1 }).limit(Math.min(limit, 100)).populate("sender", "username displayName avatar").lean();
};

export const sendDirectMessage = async ({ conversationId, userId, content, clientId = null }) => {
  const conversation = await assertParticipant(conversationId, userId);
  const existing = clientId ? await DirectMessage.findOne({ conversation: conversationId, sender: userId, clientId }).populate("sender", "username displayName avatar").lean() : null;
  if (existing) return { message: existing, recipientIds: conversation.participants.filter((id) => id.toString() !== userId.toString()) };
  const message = await DirectMessage.create({ conversation: conversationId, sender: userId, content: content.trim(), clientId });
  await Conversation.updateOne({ _id: conversationId }, { $set: { lastMessageAt: message.createdAt, lastMessage: message._id } });
  await message.populate("sender", "username displayName avatar");
  const recipientIds = conversation.participants.filter((id) => id.toString() !== userId.toString());
  await Notification.insertMany(recipientIds.map((recipient) => ({ recipient, actor: userId, type: "direct_message", message: message._id, directMessage: message._id, conversation: conversationId })), { ordered: false }).catch(() => undefined);
  return { message, recipientIds };
};

export const getConversation = (conversationId, userId) => assertParticipant(conversationId, userId);
