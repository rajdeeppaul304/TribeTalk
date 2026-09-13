import { asyncHandler } from "../Utils/asyncHandler.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { searchMessages } from "../Service/Search.service.js";

export const searchMessageContent = asyncHandler(async (req, res) => {
  const messages = await searchMessages(req.user._id, req.query.q, req.query.limit);
  res.status(200).json(new ApiResponse(200, messages, "Search results retrieved successfully"));
});
