import { ScheduledMessage } from "../Models/ScheduledMessage.model.js";
import { Channel } from "../Models/Channel.model.js";
import { checkChannelAccess } from "./Permission.service.js";
import { ApiError } from "../Utils/ApiError.js";
import { dispatchOutboxEvent } from "./Outbox.service.js";
import * as messageService from "./Message.service.js";
import { eventBus } from "../events/eventBus.js";
import { EVENTS } from "../events/eventNames.js";
import { areQueuesReady } from "../config/queues.js";
import { indexMessage } from "./Search.service.js";

export const scheduleMessage = async ({ channelId, userId, content, scheduledFor }) => {
  if (!areQueuesReady()) throw new ApiError(503, "Scheduled messages require Redis and the job worker");
  if (!(await checkChannelAccess(userId, channelId))) throw new ApiError(403, "You do not have permission to access this channel");
  const date = new Date(scheduledFor);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new ApiError(400, "scheduledFor must be a future date");
  const channel = await Channel.findById(channelId).select("_id").lean();
  if (!channel) throw new ApiError(404, "Channel not found");
  const scheduled = await ScheduledMessage.create({ channel: channelId, sender: userId, content: content.trim(), scheduledFor: date });
  await dispatchOutboxEvent({ type: "scheduled.message", payload: { scheduledId: scheduled._id.toString() }, delayMs: date.getTime() - Date.now() });
  return scheduled;
};

export const listScheduledMessages = async (channelId, userId) => {
  if (!(await checkChannelAccess(userId, channelId))) throw new ApiError(403, "You do not have permission to access this channel");
  return ScheduledMessage.find({ channel: channelId, sender: userId, status: "scheduled" }).sort({ scheduledFor: 1 }).lean();
};

export const cancelScheduledMessage = async ({ scheduledId, userId }) => {
  const scheduled = await ScheduledMessage.findOneAndUpdate({ _id: scheduledId, sender: userId, status: "scheduled" }, { $set: { status: "cancelled" } }, { new: true }).lean();
  if (!scheduled) throw new ApiError(404, "Scheduled message not found");
  return scheduled;
};

export const processScheduledMessage = async (scheduledId) => {
  const scheduled = await ScheduledMessage.findOneAndUpdate({ _id: scheduledId, status: "scheduled" }, { $set: { status: "sent" } }, { new: true });
  if (!scheduled) return null;
  try {
    const message = await messageService.addMessage({ content: scheduled.content, channelId: scheduled.channel, UserId: scheduled.sender });
    setImmediate(() => indexMessage(message).catch((error) => console.error("Failed to enqueue scheduled message indexing:", error.message)));
    await ScheduledMessage.updateOne({ _id: scheduledId }, { $set: { sentMessage: message._id } });
    eventBus.emit(EVENTS.SCHEDULED_MESSAGE_READY, { message });
    return message;
  } catch (error) {
    await ScheduledMessage.updateOne({ _id: scheduledId }, { $set: { status: "failed", error: error.message } });
    throw error;
  }
};
