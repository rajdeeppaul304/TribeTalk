import IORedis from "ioredis";
import { Queue, Worker } from "bullmq";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { OutboxEvent } from "../Models/OutboxEvent.model.js";
import { ScheduledMessage } from "../Models/ScheduledMessage.model.js";

let connection;
let outboxQueue;
let outboxWorker;
let queuesReady = false;

const connectionOptions = () => {
  const parsed = new URL(env.REDIS_URL);
  return { host: parsed.hostname, port: Number(parsed.port || 6379), username: parsed.username || undefined, password: parsed.password || undefined, db: parsed.pathname ? Number(parsed.pathname.slice(1) || 0) : 0, maxRetriesPerRequest: null, enableReadyCheck: true };
};

const processEvent = async (job) => {
  const event = await OutboxEvent.findById(job.data.eventId);
  if (!event || event.status === "completed") return;
  await OutboxEvent.updateOne({ _id: event._id }, { $set: { status: "processing" }, $inc: { attempts: 1 } });
  try {
    if (event.type === "email.auth_otp" || event.type === "email.security_alert") {
      const { sendAuthOtpNow, sendSecurityAlertNow } = await import("../Service/Email.service.js");
      if (event.type === "email.auth_otp") await sendAuthOtpNow(event.payload);
      else await sendSecurityAlertNow(event.payload);
    } else if (event.type === "search.index_message" || event.type === "search.remove_message") {
      const { indexMessageNow, removeMessageFromIndexNow } = await import("../Service/Search.service.js");
      if (event.type === "search.index_message") await indexMessageNow(event.payload, { requireReady: true });
      else await removeMessageFromIndexNow(event.payload.messageId, { requireReady: true });
    } else if (event.type === "scheduled.message") {
      const { processScheduledMessage } = await import("../Service/ScheduledMessage.service.js");
      await processScheduledMessage(event.payload.scheduledId);
    } else {
      throw new Error(`Unknown outbox event type: ${event.type}`);
    }
    await OutboxEvent.updateOne({ _id: event._id }, { $set: { status: "completed", processedAt: new Date(), lastError: "" } });
  } catch (error) {
    await OutboxEvent.updateOne({ _id: event._id }, { $set: { status: "failed", lastError: error.message, nextAttemptAt: new Date(Date.now() + 60_000) } });
    throw error;
  }
};

export const initializeQueues = async () => {
  if (!env.REDIS_URL || queuesReady) return queuesReady;
  connection = new IORedis(connectionOptions());
  connection.on("error", (error) => logger.error({ error: error.message }, "BullMQ Redis connection error"));
  outboxQueue = new Queue("tribetalk-outbox", { connection });
  outboxWorker = new Worker("tribetalk-outbox", processEvent, { connection, concurrency: 5, limiter: { max: 100, duration: 1000 } });
  outboxWorker.on("failed", (job, error) => logger.error({ jobId: job?.id, error: error.message }, "Outbox job failed"));
  await outboxWorker.waitUntilReady();
  queuesReady = true;

  const pending = await OutboxEvent.find({ status: { $in: ["pending", "failed"] }, $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: new Date() } }] }).select("_id type payload").limit(1000).lean();
  await Promise.all(pending.map(async (event) => {
    let delayMs = 0;
    if (event.type === "scheduled.message") {
      const scheduled = await ScheduledMessage.findById(event.payload?.scheduledId).select("scheduledFor status").lean();
      if (!scheduled || scheduled.status !== "scheduled") return;
      delayMs = Math.max(0, new Date(scheduled.scheduledFor).getTime() - Date.now());
    }
    return enqueueOutboxEvent(event, delayMs);
  }));
  logger.info({ pending: pending.length }, "BullMQ outbox worker ready");
  return true;
};

export const areQueuesReady = () => queuesReady;
export const enqueueOutboxEvent = async (event, delayMs = 0) => {
  if (!outboxQueue) throw new Error("Outbox queue is not initialized");
  return outboxQueue.add(event.type, { eventId: event._id.toString() }, { jobId: event._id.toString(), delay: Math.max(0, delayMs), attempts: 5, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: 1000, removeOnFail: 5000 });
};

export const shutdownQueues = async () => {
  queuesReady = false;
  await Promise.all([outboxWorker?.close(), outboxQueue?.close(), connection?.quit()].filter(Boolean));
  outboxWorker = null;
  outboxQueue = null;
  connection = null;
};
