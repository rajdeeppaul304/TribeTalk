import { getRedisClient, isRedisReady } from "../config/redis.js";
import { ApiError } from "../Utils/ApiError.js";

const localCounters = new Map();
const WINDOW_SECONDS = 10;
const MAX_MESSAGES = 8;

export const assertMessageNotSpam = async ({ userId, channelId, content }) => {
  const rateKey = `spam:rate:${userId}:${channelId}`;
  if (isRedisReady() && getRedisClient()) {
    const redis = getRedisClient();
    const count = await redis.incr(rateKey);
    if (count === 1) await redis.expire(rateKey, WINDOW_SECONDS);
    if (count > MAX_MESSAGES) throw new ApiError(429, "You are sending messages too quickly");
    return true;
  }
  const key = `${userId}:${channelId}`;
  const now = Date.now();
  const value = localCounters.get(key);
  if (!value || value.resetAt <= now) localCounters.set(key, { count: 1, resetAt: now + WINDOW_SECONDS * 1000 });
  else {
    value.count += 1;
    if (value.count > MAX_MESSAGES) throw new ApiError(429, "You are sending messages too quickly");
  }
  return true;
};
