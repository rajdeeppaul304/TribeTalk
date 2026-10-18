import { getRedisClient, isRedisReady } from "../config/redis.js";
import { logger } from "../config/logger.js";

export const getCached = async (key) => {
  if (!isRedisReady() || !getRedisClient()) return null;
  try {
    const value = await getRedisClient().get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.warn({ key, error: error.message }, "Redis cache read failed");
    return null;
  }
};

export const setCached = async (key, value, ttlSeconds = 30) => {
  if (!isRedisReady() || !getRedisClient()) return false;
  try {
    await getRedisClient().set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch (error) {
    logger.warn({ key, error: error.message }, "Redis cache write failed");
    return false;
  }
};

export const deleteCached = async (...keys) => {
  if (!isRedisReady() || !getRedisClient() || !keys.length) return false;
  try { await getRedisClient().del(keys); return true; } catch (error) { logger.warn({ keys, error: error.message }, "Redis cache invalidation failed"); return false; }
};

export const cacheKeys = {
  servers: (userId) => `cache:servers:${userId}`,
  server: (serverId, userId) => `cache:server:${serverId}:${userId}`,
  profile: (userId) => `cache:profile:${userId}`,
  search: (userId, query) => `cache:search:${userId}:${Buffer.from(query).toString("base64url")}`,
};
