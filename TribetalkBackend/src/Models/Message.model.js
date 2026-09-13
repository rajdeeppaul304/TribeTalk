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
    replyTo: { type: Types.ObjectId, ref: "Message", default: null, index: true },
    threadRoot: { type: Types.ObjectId, ref: "Message", default: null, index: true },
    reactions: [{
      emoji: { type: String, required: true, maxlength: 32 },
      users: [{ type: Types.ObjectId, ref: "User" }]
    }],
    pinnedAt: { type: Date, default: null },
    pinnedBy: { type: Types.ObjectId, ref: "User", default: null },

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
// The same client retry must resolve to the original message, never create a duplicate.
messageSchema.index({ channel: 1, sender: 1, clientId: 1 }, { unique: true, sparse: true });
messageSchema.index({ channel: 1, createdAt: -1 });
messageSchema.index({ channel: 1, threadRoot: 1, sequence: 1 });

// Index for finding messages by ID within a channel (for "after" queries)
messageSchema.index({ channel: 1, _id: 1 });

export const Message = mongoose.model("Message", messageSchema);
