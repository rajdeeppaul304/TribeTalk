import { OutboxEvent } from "../Models/OutboxEvent.model.js";
import { enqueueOutboxEvent, areQueuesReady } from "../config/queues.js";
import { logger } from "../config/logger.js";

export const dispatchOutboxEvent = async ({ type, payload, fallback, delayMs = 0 }) => {
  let event;
  try {
    event = await OutboxEvent.create({ type, payload });
  } catch (error) {
    logger.warn({ type, error: error.message }, "Could not persist outbox event; using inline fallback");
    return fallback ? fallback() : { queued: false };
  }

  if (areQueuesReady()) {
    try {
      await enqueueOutboxEvent(event, delayMs);
      return { queued: true, eventId: event._id.toString() };
    } catch (error) {
      await OutboxEvent.updateOne({ _id: event._id }, { $set: { status: "failed", lastError: error.message } });
      logger.error({ eventId: event._id, type, error: error.message }, "Could not enqueue outbox event");
      throw error;
    }
  }

  try {
    const result = fallback ? await fallback() : { queued: false };
    await OutboxEvent.updateOne({ _id: event._id }, { $set: { status: "completed", processedAt: new Date() } });
    return result;
  } catch (error) {
    await OutboxEvent.updateOne({ _id: event._id }, { $set: { status: "failed", lastError: error.message }, $inc: { attempts: 1 } });
    throw error;
  }
};
