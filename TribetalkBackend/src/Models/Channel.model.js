// Models/Channel.model.js (UPDATED)
import mongoose, { Schema, Types } from "mongoose";

const channelSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 30,
    },

    server: {
      type: Types.ObjectId,
      ref: "Server",
      required: true,
    },

    createdBy: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["text", "voice"],
      default: "text",
    },

    description: {
      type: String,
      default: "",
      maxlength: 100,
    },

    // NEW: Counter for message sequences (auto-increment per channel)
    messageSequence: {
      type: Number,
      default: 0,
    },

    // NEW: Latest message tracking
    lastMessageId: {
      type: Types.ObjectId,
      ref: "Message",
      default: null,
    },

    lastMessageAt: {
      type: Date,
      default: null,
    },

    lastMessageSequence: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for efficient server channel lookup
channelSchema.index({ server: 1 });

export const Channel = mongoose.model("Channel", channelSchema);
