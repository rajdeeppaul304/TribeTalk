// channel.handler.js
import * as messageService from "../../Service/Message.service.js";
import { formatMessageDTO } from "../socket.utils.js";
import { markTyping, clearTyping } from "../../config/redis.js";

export default function registerChannelHandlers(io, socket, typingUsers) {
    // Join channel
    socket.on("join_channel", async ({ channelId, lastKnownSequence = 0 }) => {
        try {
            console.log(`📥 join_channel: User ${socket.user._id} joining ${channelId}`);
            const syncData = await messageService.getChannelSyncData(
                socket.user._id,
                channelId
            );
            // Only join after membership authorization succeeds.
            socket.join(channelId);

            socket.emit("sync_state", {
                channelId,
                latestMessageId: syncData.latestMessageId,
                latestSequence: syncData.latestSequence,
                unreadCount: syncData.unreadCount,
                lastReadSequence: syncData.lastReadSequence
            });

            if (lastKnownSequence > 0 && lastKnownSequence < syncData.latestSequence) {
                const missedMessages = await messageService.getMissedMessages(
                    channelId,
                    lastKnownSequence
                );

                socket.emit("missed_messages", {
                    channelId,
                    messages: missedMessages.map(msg => formatMessageDTO(msg))
                });
            }
        } catch (error) {
            console.error("❌ Error in join_channel:", error);
            socket.emit("error", { message: "Failed to join channel" });
        }
    });

    // Leave channel
    socket.on("leave_channel", ({ channelId }) => {
        console.log(`📤 leave_channel: User ${socket.user._id} leaving ${channelId}`);
        socket.leave(channelId);

        if (typingUsers.has(channelId)) {
            const timer = typingUsers.get(channelId).get(socket.user._id.toString());
            if (timer) clearTimeout(timer);
            typingUsers.get(channelId).delete(socket.user._id.toString());
            void clearTyping(channelId, socket.user._id.toString());
        }
    });

    // Typing start
    socket.on("typing_start", ({ channelId }) => {
        // to stop people spamming unauthorized channels with typing indicators
        if (!channelId || !socket.rooms.has(channelId)) {
            return; // Silently discard unauthorized or invalid attempts
        }

        if (!typingUsers.has(channelId)) typingUsers.set(channelId, new Map());
        const users = typingUsers.get(channelId);
        const userId = socket.user._id.toString();
        const existingTimer = users.get(userId);
        if (existingTimer) clearTimeout(existingTimer);
        const timeout = setTimeout(() => {
            users.delete(userId);
            void clearTyping(channelId, userId);
            socket.to(channelId).emit("user_typing_stop", { channelId, userId });
            if (users.size === 0) typingUsers.delete(channelId);
        }, 5_000);
        users.set(userId, timeout);
        void markTyping(channelId, userId);

        socket.to(channelId).emit("user_typing", {
            channelId,
            userId: socket.user._id.toString(),
            username: socket.user.username
        });
    });

    // Typing stop
    socket.on("typing_stop", ({ channelId }) => {
        if (!channelId || !socket.rooms.has(channelId)) {
            return;
        } 
        if (typingUsers.has(channelId)) {
            const users = typingUsers.get(channelId);
            const timer = users.get(socket.user._id.toString());
            if (timer) clearTimeout(timer);
            users.delete(socket.user._id.toString());
            void clearTyping(channelId, socket.user._id.toString());
        }

        socket.to(channelId).emit("user_typing_stop", {
            channelId,
            userId: socket.user._id.toString()
        });
    });
}
