import mongoose, { Schema, Types } from "mongoose";
import { randomUUID } from "node:crypto";

const inviteSchema = new Schema({
  server: { type: Types.ObjectId, ref: "Server", required: true, index: true },
  code: { type: String, required: true, unique: true, default: () => randomUUID() },
  createdBy: { type: Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, default: null },
  maxUses: { type: Number, default: null, min: 1 },
  uses: { type: Number, default: 0, min: 0 },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

inviteSchema.index({ server: 1, createdAt: -1 });
export const Invite = mongoose.model("Invite", inviteSchema);
