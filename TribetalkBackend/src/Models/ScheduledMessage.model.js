import mongoose, { Schema, Types } from "mongoose";

const scheduledMessageSchema = new Schema({
  channel: { type: Types.ObjectId, ref: "Channel", required: true, index: true },
  sender: { type: Types.ObjectId, ref: "User", required: true },
  content: { type: String, trim: true, maxlength: 2000, required: true },
  scheduledFor: { type: Date, required: true, index: true },
  status: { type: String, enum: ["scheduled", "sent", "cancelled", "failed"], default: "scheduled", index: true },
  sentMessage: { type: Types.ObjectId, ref: "Message", default: null },
  error: { type: String, default: "" },
}, { timestamps: true });

scheduledMessageSchema.index({ status: 1, scheduledFor: 1 });

export const ScheduledMessage = mongoose.model("ScheduledMessage", scheduledMessageSchema);
