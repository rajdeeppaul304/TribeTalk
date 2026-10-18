import { asyncHandler } from "../Utils/asyncHandler.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import * as directMessageService from "../Service/DirectMessage.service.js";

export const createConversation = asyncHandler(async (req, res) => {
  const conversation = await directMessageService.createConversation({ userId: req.user._id, participantId: req.body.participantId });
  return res.status(201).json(new ApiResponse(201, conversation, "Conversation ready"));
});

export const listConversations = asyncHandler(async (req, res) => res.json(new ApiResponse(200, await directMessageService.listConversations(req.user._id), "Conversations retrieved")));

export const listMessages = asyncHandler(async (req, res) => {
  const messages = await directMessageService.listMessages({ conversationId: req.params.id, userId: req.user._id, limit: req.query.limit, before: req.query.before });
  return res.json(new ApiResponse(200, messages, "Direct messages retrieved"));
});

export const sendMessage = asyncHandler(async (req, res) => {
  const result = await directMessageService.sendDirectMessage({ conversationId: req.params.id, userId: req.user._id, content: req.body.content, clientId: req.body.clientId });
  return res.status(201).json(new ApiResponse(201, result.message, "Direct message sent"));
});
