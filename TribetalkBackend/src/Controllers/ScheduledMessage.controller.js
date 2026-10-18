import { asyncHandler } from "../Utils/asyncHandler.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import * as scheduledService from "../Service/ScheduledMessage.service.js";

export const scheduleMessage = asyncHandler(async (req, res) => {
  const scheduled = await scheduledService.scheduleMessage({ channelId: req.body.channelId, userId: req.user._id, content: req.body.content, scheduledFor: req.body.scheduledFor });
  return res.status(201).json(new ApiResponse(201, scheduled, "Message scheduled"));
});

export const listScheduledMessages = asyncHandler(async (req, res) => res.json(new ApiResponse(200, await scheduledService.listScheduledMessages(req.params.channelId, req.user._id), "Scheduled messages retrieved")));

export const cancelScheduledMessage = asyncHandler(async (req, res) => {
  const scheduled = await scheduledService.cancelScheduledMessage({ scheduledId: req.params.id, userId: req.user._id });
  return res.json(new ApiResponse(200, scheduled, "Scheduled message cancelled"));
});
