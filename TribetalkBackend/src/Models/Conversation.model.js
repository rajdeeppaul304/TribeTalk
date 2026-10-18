import mongoose, { Schema, Types } from "mongoose";

const conversationSchema = new Schema({
  participants: [{ type: Types.ObjectId, ref: "User", required: true }],
  participantKey: { type: String, required: true, unique: true, index: true },
  lastMessageAt: { type: Date, default: null },
  lastMessage: { type: Types.ObjectId, ref: "DirectMessage", default: null },
}, { timestamps: true });

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

export const Conversation = mongoose.model("Conversation", conversationSchema);
