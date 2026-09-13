import { asyncHandler } from "../Utils/asyncHandler.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { uploadImage } from "../config/cloudinary.js";

export const uploadImageFile = asyncHandler(async (req, res) => {
  const attachment = await uploadImage(req.file);
  return res.status(201).json(new ApiResponse(201, attachment, "Image uploaded successfully"));
});
