import mongoose from "mongoose";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import * as messageService from "../Service/Message.service.js";

/**
 * GET /api/v1/channels/:channelId/messages
 */
export const getMessageHistory = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { limit = 50, before, after } = req.query;

  if (before && !mongoose.Types.ObjectId.isValid(before)) {
    throw new ApiError(400, "Invalid 'before' cursor ID");
  }
  if (after && !mongoose.Types.ObjectId.isValid(after)) {
    throw new ApiError(400, "Invalid 'after' cursor ID");
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

  const messages = await messageService.getMessageHistory({
    channelId,
    limit: parsedLimit,
    before,
    after
  });

  return res.status(200).json(
    new ApiResponse(200, {
      messages,
      hasMore: messages.length === parsedLimit,
      cursor: messages.length > 0 ? messages[messages.length - 1]._id : null
    }, "Messages retrieved successfully")
  );
});

export const getThread = asyncHandler(async (req, res) => {
  const messages = await messageService.getThread({ channelId: req.params.channelId, rootId: req.params.messageId, userId: req.user._id });
  return res.json(new ApiResponse(200, messages, "Thread retrieved successfully"));
});

/**
 * POST /api/v1/channels/:channelId/mark-read
 */
export const markChannelAsRead = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { lastReadMessageId } = req.body;
  const userId = req.user._id;

  if (lastReadMessageId && !mongoose.Types.ObjectId.isValid(lastReadMessageId)) {
    throw new ApiError(400, "Invalid lastReadMessageId format");
  }

  const readState = await messageService.markAsRead(userId, channelId, lastReadMessageId);

  return res.status(200).json(
    new ApiResponse(200, readState, "Channel marked as read")
  );
});

/**
 * GET /api/v1/channels/:channelId/unread-count
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const userId = req.user._id;

  const unreadCount = await messageService.getUnreadCount(userId, channelId);

  return res.status(200).json(
    new ApiResponse(200, { unreadCount }, "Unread count retrieved successfully")
  );
});

/**
 * GET /api/v1/channels/:channelId/sync
 */
export const getChannelSyncData = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const userId = req.user._id;

  const syncData = await messageService.getChannelSyncData(userId, channelId);

  return res.status(200).json(
    new ApiResponse(200, syncData, "Sync data retrieved successfully")
  );
});

/**
 * PUT /api/v1/messages/:messageId
 */
export const editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw new ApiError(400, "Invalid message ID format");
  }

  if (!content || !content.trim()) {
    throw new ApiError(400, "Message content is required");
  }

  const updatedMessage = await messageService.editMessage(messageId, content, userId);

  return res.status(200).json(
    new ApiResponse(200, updatedMessage, "Message updated successfully")
  );
});

/**
 * DELETE /api/v1/messages/:messageId
 */
export const deleteMessageById = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw new ApiError(400, "Invalid message ID format");
  }

  const deletedMessage = await messageService.deleteMessage(messageId, userId);

  return res.status(200).json(
    new ApiResponse(200, deletedMessage, "Message deleted successfully")
  );
});
