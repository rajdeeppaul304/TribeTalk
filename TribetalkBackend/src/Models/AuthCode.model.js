import mongoose, { Schema, Types } from "mongoose";

const authCodeSchema = new Schema({
  user: { type: Types.ObjectId, ref: "User", required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  purpose: { type: String, enum: ["email_verification", "password_reset"], required: true, index: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  sentAt: { type: Date, default: Date.now },
  consumedAt: { type: Date, default: null },
}, { timestamps: true });

authCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authCodeSchema.index({ user: 1, purpose: 1, consumedAt: 1 });

export const AuthCode = mongoose.model("AuthCode", authCodeSchema);
