import multer from "multer";
import { ApiError } from "../Utils/ApiError.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new ApiError(400, "Only image uploads are supported"));
      return;
    }
    callback(null, true);
  },
});

export const uploadSingleImage = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      next(new ApiError(413, "Image must be 5 MB or smaller"));
      return;
    }
    if (error) return next(error);
    if (!req.file) return next(new ApiError(400, "An image file is required"));
    next();
  });
};
