import mongoose, { Schema, Types } from "mongoose";

const outboxEventSchema = new Schema({
  type: { type: String, required: true, index: true },
  payload: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending", index: true },
  attempts: { type: Number, default: 0 },
  lastError: { type: String, default: "" },
  processedAt: { type: Date, default: null },
  nextAttemptAt: { type: Date, default: null },
}, { timestamps: true });

outboxEventSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });

export const OutboxEvent = mongoose.model("OutboxEvent", outboxEventSchema);
