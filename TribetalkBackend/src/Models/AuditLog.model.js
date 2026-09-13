import mongoose, { Schema, Types } from "mongoose";

const auditLogSchema = new Schema({
  server: { type: Types.ObjectId, ref: "Server", required: true, index: true },
  actor: { type: Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true, maxlength: 80 },
  targetUser: { type: Types.ObjectId, ref: "User", default: null },
  targetId: { type: String, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

auditLogSchema.index({ server: 1, createdAt: -1 });
export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
