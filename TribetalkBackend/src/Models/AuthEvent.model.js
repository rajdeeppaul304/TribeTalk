import mongoose, { Schema, Types } from "mongoose";

const authEventSchema = new Schema({
  user: { type: Types.ObjectId, ref: "User", default: null, index: true },
  email: { type: String, lowercase: true, trim: true, default: null, index: true },
  event: { type: String, required: true, index: true },
  status: { type: String, enum: ["success", "failure", "suspicious"], required: true },
  ip: { type: String, default: null },
  userAgent: { type: String, default: null },
  requestId: { type: String, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

authEventSchema.index({ createdAt: -1 });
authEventSchema.index({ email: 1, createdAt: -1 });

export const AuthEvent = mongoose.model("AuthEvent", authEventSchema);
