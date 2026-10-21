import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedisClient } from "../config/redis.js";
import { env } from "../config/env.js";

const jsonLimitMessage = (message) => ({
  statusCode: 429,
  data: null,
  message,
  success: false,
});

const createRedisStore = (prefix) => {
  const client = getRedisClient();
  if (!client) return undefined;
  return new RedisStore({
    prefix,
    sendCommand: (...args) => client.sendCommand(args),
  });
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: jsonLimitMessage("Too many requests. Please try again later."),
  store: createRedisStore("tribetalk:rate:api:"),
  passOnStoreError: true,
  skip: (req) => env.NODE_ENV === "development" && env.LOAD_TEST_MODE && env.LOAD_TEST_KEY && req.get("x-tribetalk-load-test") === env.LOAD_TEST_KEY,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: jsonLimitMessage("Too many authentication attempts. Please try again later."),
  store: createRedisStore("tribetalk:rate:auth:"),
  passOnStoreError: true,
  skip: (req) => env.NODE_ENV === "development" && env.LOAD_TEST_MODE && env.LOAD_TEST_KEY && req.get("x-tribetalk-load-test") === env.LOAD_TEST_KEY,
});
