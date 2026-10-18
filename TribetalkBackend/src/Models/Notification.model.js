import mongoose, { Schema, Types } from "mongoose";

const notificationSchema = new Schema({
  recipient: { type: Types.ObjectId, ref: "User", required: true, index: true },
  actor: { type: Types.ObjectId, ref: "User", required: true },
  server: { type: Types.ObjectId, ref: "Server", default: null },
  channel: { type: Types.ObjectId, ref: "Channel", default: null },
  message: { type: Types.ObjectId, ref: "Message", default: null },
  conversation: { type: Types.ObjectId, ref: "Conversation", default: null },
  directMessage: { type: Types.ObjectId, ref: "DirectMessage", default: null },
  metadata: { type: Schema.Types.Mixed, default: null },
  type: { type: String, enum: ["mention", "unread", "direct_message", "moderation_warning", "moderation_ban"], required: true },
  readAt: { type: Date, default: null },
}, { timestamps: true });
notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, message: 1, type: 1 }, { unique: true, partialFilterExpression: { message: { $type: "objectId" } } });
notificationSchema.index({ recipient: 1, directMessage: 1, type: 1 }, { unique: true, partialFilterExpression: { directMessage: { $type: "objectId" } } });
export const Notification = mongoose.model("Notification", notificationSchema);
