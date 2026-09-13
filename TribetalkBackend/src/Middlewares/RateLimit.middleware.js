import { rateLimit } from "express-rate-limit";

const jsonLimitMessage = (message) => ({
  statusCode: 429,
  data: null,
  message,
  success: false,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: jsonLimitMessage("Too many requests. Please try again later."),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: jsonLimitMessage("Too many authentication attempts. Please try again later."),
});
