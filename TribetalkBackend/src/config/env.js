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
  NODE_ENV: process.env.NODE_ENV || "development",
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
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  EMAIL_FROM: process.env.EMAIL_FROM || "",
  APP_URL: process.env.APP_URL || "http://localhost:5173",
  EMAIL_VERIFICATION_REQUIRED: process.env.EMAIL_VERIFICATION_REQUIRED === "true",
  LOAD_TEST_MODE: process.env.LOAD_TEST_MODE === "true",
  LOAD_TEST_KEY: process.env.LOAD_TEST_KEY || "",
};
