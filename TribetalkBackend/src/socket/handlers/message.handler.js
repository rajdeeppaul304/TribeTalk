// message.handler.js

import * as messageService from "../../Service/Message.service.js";
import * as channelService from "../../Service/Channel.service.js";

import { formatMessageDTO } from "../socket.utils.js";
import { z } from "zod";
import { isTrustedCloudinaryAttachment } from "../../config/cloudinary.js";
import { createMessageNotifications } from "../../Service/Notification.service.js";
import { metrics } from "../../config/metrics.js";
import * as directMessageService from "../../Service/DirectMessage.service.js";
import { assertMessageNotSpam } from "../../Service/Spam.service.js";

const attachmentSchema = z.object({
    url: z.string().url(),
    publicId: z.string().min(1).max(255),
    format: z.string().min(1).max(20),
    bytes: z.number().int().positive().max(5 * 1024 * 1024),
    width: z.number().int().positive().max(2400),
    height: z.number().int().positive().max(2400),
});

const sendMessageSchema = z.object({
    channelId: z.string().regex(/^[a-f\d]{24}$/i),
    content: z.string().trim().max(2000).optional().default(""),
    clientId: z.string().max(100).nullable().optional(),
    replyTo: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
    attachments: z.array(attachmentSchema).max(4).optional().default([]),
}).refine((payload) => payload.content.length > 0 || payload.attachments.length > 0, {
    message: "Message content or an attachment is required",
});

export default function registerMessageHandlers(io, socket) {
    socket.on("send_message", async (payload, acknowledge) => {
        const parsedPayload = sendMessageSchema.safeParse(payload);
        const clientId = parsedPayload.success ? parsedPayload.data.clientId : payload?.clientId;
        try {
            if (!parsedPayload.success) {
                throw new Error("Invalid message payload");
            }
            const { channelId, content, attachments, replyTo } = parsedPayload.data;
            if (attachments.some((attachment) => !isTrustedCloudinaryAttachment(attachment))) {
                throw new Error("Invalid image attachment");
            }
            const user = socket.user;
            if (content.trim()) await assertMessageNotSpam({ userId: user._id, channelId, content });

            const savedMessage = await messageService.addMessage({
                content,
                channelId,
                UserId: user._id,
                clientId,
                attachments,
                replyTo,
            });

            const messageWithUser = {
                ...(savedMessage.toObject ? savedMessage.toObject() : savedMessage),
                sender: {
                    _id: user._id,
                    username: user.username,
                    avatar: user.avatar
                }
            };

            const messageDTO = formatMessageDTO(messageWithUser);
            metrics.increment("messagesSent");

            // The sender receives its clientId as an acknowledgement; peers do not.
            socket.emit("new_message", messageDTO);
            if (typeof acknowledge === "function") acknowledge({ ok: true, message: messageDTO });

            socket.to(channelId).emit("new_message", {
                ...messageDTO,
                clientId: null
            });
            const notifications = await createMessageNotifications({ message: savedMessage, senderId: user._id }).catch((error) => {
                console.error("Failed to create notifications:", error.message);
                return [];
            });
            notifications.forEach((notification) => io.to(`user:${notification.recipient}`).emit("notification", notification));

            // 🔧 FIX: scope to the server room, not a global broadcast
            const serverId = await channelService.channelActivity({ channelId });
            io.to(`server:${serverId}`).emit("channel_activity", {
                channelId,
                serverId: serverId.toString()
            });
        } catch (error) {
            console.error("❌ Error in send_message:", error);
            socket.emit("error", {
                message: error?.message || "Failed to send message",
                reason: error?.statusCode === 429 ? "spam" : undefined,
                clientId,
                channelId: parsedPayload.success ? parsedPayload.data.channelId : undefined,
            });
            if (typeof acknowledge === "function") acknowledge({ ok: false, error: error?.message || "Failed to send message" });
        }
    });

    socket.on("send_direct_message", async ({ conversationId, content, clientId = null }) => {
        try {
            const result = await directMessageService.sendDirectMessage({ conversationId, userId: socket.user._id, content, clientId });
            const dto = result.message.toObject ? result.message.toObject() : result.message;
            result.recipientIds.forEach((recipientId) => {
                io.to(`user:${recipientId}`).emit("direct_message", dto);
                io.to(`user:${recipientId}`).emit("notification", { type: "direct_message", conversationId, messageId: dto._id });
            });
            socket.emit("direct_message", dto);
        } catch (error) {
            socket.emit("error", { message: error.message || "Failed to send direct message", clientId, conversationId });
        }
    });

    socket.on("toggle_reaction", async ({ messageId, emoji }) => {
        try {
            if (!/^[a-f\d]{24}$/i.test(messageId || "") || typeof emoji !== "string" || !emoji.trim() || emoji.length > 32) throw new Error("Invalid reaction");
            const message = await messageService.toggleReaction({ messageId, emoji: emoji.trim(), userId: socket.user._id });
            io.to(message.channel.toString()).emit("message_updated", formatMessageDTO(message));
        } catch (error) { socket.emit("error", { message: error.message || "Failed to update reaction" }); }
    });

    socket.on("toggle_pin", async ({ messageId }) => {
        try {
            if (!/^[a-f\d]{24}$/i.test(messageId || "")) throw new Error("Invalid message");
            const message = await messageService.togglePin({ messageId, userId: socket.user._id });
            io.to(message.channel.toString()).emit("message_updated", formatMessageDTO(message));
        } catch (error) { socket.emit("error", { message: error.message || "Failed to update pin" }); }
    });


    // Edit message
    socket.on("edit_message", async ({ messageId, content }) => {
        try {
            const updatedMessage = await messageService.editMessage(
                messageId,
                content,
                socket.user._id
            );

            const messageDTO = formatMessageDTO(updatedMessage);
            io.to(updatedMessage.channel.toString()).emit("message_updated", messageDTO);
        } catch (error) {
            console.error("❌ Error in edit_message:", error);
            socket.emit("error", { message: error.message || "Failed to edit message" });
        }
    });

    // Delete message
    socket.on("delete_message", async ({ messageId }) => {
        try {
            const deletedMessage = await messageService.deleteMessage(messageId, socket.user._id);

            const messageDTO = formatMessageDTO(deletedMessage);
            io.to(deletedMessage.channel.toString()).emit("message_deleted", {
                channelId: deletedMessage.channel.toString(),
                messageId: deletedMessage._id.toString(),
                message: messageDTO
            });
        } catch (error) {
            console.error("❌ Error in delete_message:", error);
            socket.emit("error", { message: error.message || "Failed to delete message" });
        }
    });
}
