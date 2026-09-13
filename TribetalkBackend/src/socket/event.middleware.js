import { z } from "zod";
import { getRedisClient, isRedisReady } from "../config/redis.js";
import { metrics } from "../config/metrics.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const schemas = {
  presence_heartbeat: z.undefined().or(z.object({}).passthrough()),
  join_channel: z.object({ channelId: objectId, lastKnownSequence: z.number().int().min(0).optional() }),
  leave_channel: z.object({ channelId: objectId }),
  typing_start: z.object({ channelId: objectId }),
  typing_stop: z.object({ channelId: objectId }),
  mark_read: z.object({ channelId: objectId, lastReadMessageId: objectId.optional() }),
  request_sync: z.object({ channelId: objectId, lastReceivedSequence: z.number().int().min(0) }),
  send_message: z.object({ channelId: objectId, content: z.string().max(2000).optional(), clientId: z.string().max(100).optional().nullable(), attachments: z.array(z.unknown()).max(4).optional(), replyTo: objectId.optional().nullable() }),
  edit_message: z.object({ messageId: objectId, content: z.string().trim().min(1).max(2000) }),
  delete_message: z.object({ messageId: objectId }),
  toggle_reaction: z.object({ messageId: objectId, emoji: z.string().trim().min(1).max(32) }),
  toggle_pin: z.object({ messageId: objectId }),
  get_unread_counts: z.undefined().or(z.object({}).passthrough()),
};

const limits = { send_message: [30, 10], typing_start: [20, 10], typing_stop: [20, 10], edit_message: [15, 10], delete_message: [15, 10], toggle_reaction: [30, 10], toggle_pin: [10, 10], default: [60, 10] };
const localCounters = new Map();

const isWithinLimit = async (userId, event) => {
  const [limit, seconds] = limits[event] || limits.default;
  const key = `socket-rate:${userId}:${event}`;
  if (isRedisReady() && getRedisClient()) {
    const redis = getRedisClient();
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, seconds);
    return count <= limit;
  }
  const now = Date.now(); const value = localCounters.get(key) || { count: 0, resetAt: now + seconds * 1000 };
  const next = value.resetAt <= now ? { count: 1, resetAt: now + seconds * 1000 } : { ...value, count: value.count + 1 };
  localCounters.set(key, next);
  return next.count <= limit;
};

export const socketEventMiddleware = (socket) => async ([event, payload], next) => {
  try {
    const schema = schemas[event];
    if (schema && !schema.safeParse(payload).success) return next(new Error(`Invalid payload for ${event}`));
    if (!(await isWithinLimit(socket.user._id.toString(), event))) return next(new Error("Socket event rate limit exceeded"));
    next();
  } catch (error) {
    metrics.increment("socketEventErrors");
    next(new Error("Socket event could not be processed"));
  }
};
