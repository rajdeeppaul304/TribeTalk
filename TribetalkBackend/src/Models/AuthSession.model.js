import mongoose, { Schema, Types } from "mongoose";

const authSessionSchema = new Schema({
  user: { type: Types.ObjectId, ref: "User", required: true, index: true },
  sessionId: { type: String, required: true, unique: true, index: true },
  refreshTokenHash: { type: String, required: true },
  ip: { type: String, default: null },
  userAgent: { type: String, default: null },
  lastUsedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null, index: true },
  replacedBy: { type: String, default: null },
}, { timestamps: true });

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthSession = mongoose.model("AuthSession", authSessionSchema);
