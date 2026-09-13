import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";
import { ApiError } from "../Utils/ApiError.js";

if (env.CLOUDINARY_CONFIGURED) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export const uploadImage = (file) => new Promise((resolve, reject) => {
  if (!env.CLOUDINARY_CONFIGURED) {
    reject(new ApiError(503, "Image uploads are not configured yet"));
    return;
  }

  const stream = cloudinary.uploader.upload_stream(
    {
      folder: "tribetalk",
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
      transformation: [{ width: 2400, height: 2400, crop: "limit" }],
    },
    (error, result) => {
      if (error || !result) {
        reject(new ApiError(502, "Image upload provider failed"));
        return;
      }
      resolve({
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
      });
    }
  );
  stream.end(file.buffer);
});

export const isTrustedCloudinaryAttachment = (attachment) => {
  if (!env.CLOUDINARY_CONFIGURED) return false;
  try {
    const url = new URL(attachment.url);
    return url.hostname === "res.cloudinary.com" &&
      url.pathname.startsWith(`/${env.CLOUDINARY_CLOUD_NAME}/`) &&
      attachment.publicId.startsWith("tribetalk/");
  } catch {
    return false;
  }
};
