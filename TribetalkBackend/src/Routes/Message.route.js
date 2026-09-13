import express from "express";
import * as messageController from "../Controllers/Message.controller.js";
import { verifyJWT } from "../Middlewares/Auth.middleware.js";
import { verifyChannelAccess } from "../Middlewares/ChannelAccess.middleware.js";
import { validate } from "../Middlewares/Validate.middleware.js";
import { channelMessageIdParamsSchema, editMessageSchema, markReadSchema, messageHistorySchema, messageIdParamsSchema } from "../Validation/schemas.js";

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// ============================================
// CHANNEL-SCOPED MESSAGING (Guarded by Channel Access)
// ============================================

// Get message history for a channel (cursor-based pagination)
router.get("/:channelId/messages/:messageId/thread", validate(channelMessageIdParamsSchema), verifyChannelAccess, messageController.getThread);
router.get("/:channelId/messages", validate(messageHistorySchema), verifyChannelAccess, messageController.getMessageHistory);

// Mark channel as read
router.post("/:channelId/mark-read", validate(markReadSchema), verifyChannelAccess, messageController.markChannelAsRead);

// Get unread count for a channel
router.get("/:channelId/unread-count", validate(messageHistorySchema), verifyChannelAccess, messageController.getUnreadCount);

// Get sync data for a channel (latest message + unread)
router.get("/:channelId/sync", validate(messageHistorySchema), verifyChannelAccess, messageController.getChannelSyncData);

// ============================================
// INDIVIDUAL MESSAGE OPERATIONS (Ownership checked in Service)
// ============================================

// Edit a message
router.put("/messages/:messageId", validate(editMessageSchema), messageController.editMessage);

// Delete a message
router.delete("/messages/:messageId", validate(messageIdParamsSchema), messageController.deleteMessageById);

export default router;
