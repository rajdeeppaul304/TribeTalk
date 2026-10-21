import { getRedisClient, isRedisReady } from "../config/redis.js";
import { logger } from "../config/logger.js";
import { metrics } from "../config/metrics.js";
import { env } from "../config/env.js";

const cacheName = (key) => String(key).split(":")[1] || "unknown";

export const getCached = async (key) => {
  const cache = cacheName(key);
  if (!env.CACHE_ENABLED) { metrics.cacheMiss(cache); return null; }
  if (!isRedisReady() || !getRedisClient()) { metrics.cacheMiss(cache); return null; }
  try {
    const value = await getRedisClient().get(key);
    if (!value) { metrics.cacheMiss(cache); return null; }
    metrics.cacheHit(cache);
    return JSON.parse(value);
  } catch (error) {
    metrics.cacheMiss(cache);
    logger.warn({ key, error: error.message }, "Redis cache read failed");
    return null;
  }
};

export const setCached = async (key, value, ttlSeconds = 30) => {
  const cache = cacheName(key);
  if (!env.CACHE_ENABLED) { metrics.cacheWrite(cache, "disabled"); return false; }
  if (!isRedisReady() || !getRedisClient()) { metrics.cacheWrite(cache, "unavailable"); return false; }
  try {
    await getRedisClient().set(key, JSON.stringify(value), { EX: ttlSeconds });
    metrics.cacheWrite(cache); return true;
  } catch (error) {
    metrics.cacheWrite(cache, "error");
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
