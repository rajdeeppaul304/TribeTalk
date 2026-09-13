import mongoose, { Schema, Types } from "mongoose";

const notificationSchema = new Schema({
  recipient: { type: Types.ObjectId, ref: "User", required: true, index: true },
  actor: { type: Types.ObjectId, ref: "User", required: true },
  server: { type: Types.ObjectId, ref: "Server", required: true },
  channel: { type: Types.ObjectId, ref: "Channel", required: true },
  message: { type: Types.ObjectId, ref: "Message", required: true },
  type: { type: String, enum: ["mention", "unread"], required: true },
  readAt: { type: Date, default: null },
}, { timestamps: true });
notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, message: 1, type: 1 }, { unique: true });
export const Notification = mongoose.model("Notification", notificationSchema);
