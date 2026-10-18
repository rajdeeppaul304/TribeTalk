import mongoose, { Schema, Types } from "mongoose";

const directMessageSchema = new Schema({
  conversation: { type: Types.ObjectId, ref: "Conversation", required: true, index: true },
  sender: { type: Types.ObjectId, ref: "User", required: true, index: true },
  content: { type: String, trim: true, maxlength: 2000, required: true },
  clientId: { type: String, default: null },
}, { timestamps: true });

directMessageSchema.index({ conversation: 1, createdAt: -1 });
directMessageSchema.index({ conversation: 1, sender: 1, clientId: 1 }, { unique: true, sparse: true });

export const DirectMessage = mongoose.model("DirectMessage", directMessageSchema);
