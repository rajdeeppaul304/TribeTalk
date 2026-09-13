import { createClient } from "redis";
import { env } from "./env.js";

let redisClient = null;
let redisPubClient = null;
let redisSubClient = null;
let redisReady = false;

if (env.REDIS_URL) {
  redisClient = createClient({ url: env.REDIS_URL });
  redisPubClient = redisClient.duplicate();
  redisSubClient = redisClient.duplicate();

  for (const client of [redisClient, redisPubClient, redisSubClient]) {
    client.on("error", (error) => console.error("Redis client error:", error.message));
  }
}

export const initializeRedis = async () => {
  if (!redisClient) return null;
  try {
    await Promise.all([redisClient.connect(), redisPubClient.connect(), redisSubClient.connect()]);
    redisReady = true;
    console.log("✅ Redis connected");
    return { client: redisClient, pubClient: redisPubClient, subClient: redisSubClient };
  } catch (error) {
    console.error("⚠️ Redis unavailable; continuing without distributed features:", error.message);
    await shutdownRedis();
    return null;
  }
};

export const getRedisClient = () => redisClient;
export const isRedisReady = () => redisReady;

export const shutdownRedis = async () => {
  redisReady = false;
  const clients = [redisClient, redisPubClient, redisSubClient].filter((client) => client?.isOpen);
  await Promise.all(clients.map((client) => client.quit().catch(() => client.disconnect())));
};

const presenceUserKey = (userId) => `presence:user:${userId}`;
const presenceSocketKey = (socketId) => `presence:socket:${socketId}`;
const PRESENCE_TTL_SECONDS = 90;

export const markSocketOnline = async (userId, socketId) => {
  if (!redisReady || !redisClient) return;
  await redisClient.multi()
    .sAdd(presenceUserKey(userId), socketId)
    .expire(presenceUserKey(userId), PRESENCE_TTL_SECONDS)
    .set(presenceSocketKey(socketId), userId, { EX: PRESENCE_TTL_SECONDS })
    .exec();
};

export const refreshSocketPresence = async (userId, socketId) => {
  await markSocketOnline(userId, socketId);
};

export const markSocketOffline = async (userId, socketId) => {
  if (!redisReady || !redisClient) return;
  await redisClient.multi()
    .sRem(presenceUserKey(userId), socketId)
    .del(presenceSocketKey(socketId))
    .exec();

  if (await redisClient.sCard(presenceUserKey(userId)) === 0) {
    await redisClient.del(presenceUserKey(userId));
  }
};
