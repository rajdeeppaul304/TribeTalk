import mongoose, { Schema, Types } from "mongoose";

const moderationActionSchema = new Schema({
  server: { type: Types.ObjectId, ref: "Server", required: true, index: true },
  targetUser: { type: Types.ObjectId, ref: "User", required: true, index: true },
  actor: { type: Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["warning", "temporary_ban"], required: true },
  reason: { type: String, trim: true, maxlength: 500, default: "" },
  expiresAt: { type: Date, default: null, index: true },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

moderationActionSchema.index({ server: 1, targetUser: 1, createdAt: -1 });
moderationActionSchema.index({ server: 1, type: 1, expiresAt: 1 });

export const ModerationAction = mongoose.model("ModerationAction", moderationActionSchema);
