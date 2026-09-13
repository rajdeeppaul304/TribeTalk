const required = ["MONGODB_URI", "ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const port = Number.parseInt(process.env.PORT || "3000", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port number");
}

const cookieSecure = process.env.COOKIE_SECURE === "true";
const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

export const env = {
  PORT: port,
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  COOKIE_SECURE: cookieSecure,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
  CLOUDINARY_CONFIGURED: cloudinaryConfigured,
  REDIS_URL: process.env.REDIS_URL || "",
  ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL || "",
  METRICS_TOKEN: process.env.METRICS_TOKEN || "",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "",
};
