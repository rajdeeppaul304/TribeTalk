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
const typingKey = (channelId, userId) => `typing:${channelId}:${userId}`;

export const markSocketOnline = async (userId, socketId) => {
  if (!redisReady || !redisClient) return false;
  const wasOnline = await redisClient.exists(presenceUserKey(userId));
  await redisClient.multi()
    .sAdd(presenceUserKey(userId), socketId)
    .expire(presenceUserKey(userId), PRESENCE_TTL_SECONDS)
    .set(presenceSocketKey(socketId), userId, { EX: PRESENCE_TTL_SECONDS })
    .exec();
  return !wasOnline;
};

export const refreshSocketPresence = async (userId, socketId) => {
  await markSocketOnline(userId, socketId);
};

export const markSocketOffline = async (userId, socketId) => {
  if (!redisReady || !redisClient) return false;
  await redisClient.multi()
    .sRem(presenceUserKey(userId), socketId)
    .del(presenceSocketKey(socketId))
    .exec();

  if (await redisClient.sCard(presenceUserKey(userId)) === 0) {
    await redisClient.del(presenceUserKey(userId));
    return true;
  }
  return false;
};

export const getUsersPresence = async (userIds) => {
  if (!redisReady || !redisClient || userIds.length === 0) return Object.fromEntries(userIds.map((id) => [id.toString(), false]));
  const values = await Promise.all(userIds.map((id) => redisClient.exists(presenceUserKey(id))));
  return Object.fromEntries(userIds.map((id, index) => [id.toString(), Boolean(values[index])]));
};
export const markTyping = async (channelId, userId) => {
  if (redisReady && redisClient) await redisClient.set(typingKey(channelId, userId), "1", { EX: 5 });
};
export const clearTyping = async (channelId, userId) => {
  if (redisReady && redisClient) await redisClient.del(typingKey(channelId, userId));
};
