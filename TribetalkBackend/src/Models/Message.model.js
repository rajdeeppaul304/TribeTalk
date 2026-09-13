// Models/Message.model.js (UPDATED)
import mongoose, { Schema, Types } from "mongoose";

const messageSchema = new Schema(
  {
    content: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    sender: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },

    channel: {
      type: Types.ObjectId,
      ref: "Channel",
      required: true,
    },

    // NEW: Sequence number for strict ordering within a channel
    sequence: {
      type: Number,
      required: true,
      index: true,
    },

    isEdited: {
      type: Boolean,
      default: false,
    },

    // NEW: Track when message was edited
    editedAt: {
      type: Date,
      default: null,
    },

    // NEW: Soft delete support
    deletedAt: {
      type: Date,
      default: null,
    },

    // NEW: System messages (user joined, etc.)
    isSystemMessage: {
      type: Boolean,
      default: false,
    },

    // NEW: For optimistic updates - client can send a temp ID
    clientId: {
      type: String,
      default: null,
    },

    attachments: [{
      url: { type: String, required: true },
      publicId: { type: String, required: true },
      format: { type: String, required: true },
      bytes: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true },
    }],
  },
  { timestamps: true }
);

// Compound index for efficient cursor-based pagination
messageSchema.index({ channel: 1, sequence: -1 });
messageSchema.index({ channel: 1, createdAt: -1 });

// Index for finding messages by ID within a channel (for "after" queries)
messageSchema.index({ channel: 1, _id: 1 });

export const Message = mongoose.model("Message", messageSchema);
