// channel.handler.js
import * as messageService from "../../Service/Message.service.js";
import { formatMessageDTO } from "../socket.utils.js";

export default function registerChannelHandlers(io, socket, typingUsers) {
    // Join channel
    socket.on("join_channel", async ({ channelId, lastKnownSequence = 0 }) => {
        try {
            console.log(`📥 join_channel: User ${socket.user._id} joining ${channelId}`);

            socket.join(channelId);

            const syncData = await messageService.getChannelSyncData(
                socket.user._id,
                channelId
            );

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
            typingUsers.get(channelId).delete(socket.user._id.toString());
        }
    });

    // Typing start
    socket.on("typing_start", ({ channelId }) => {
        // to stop people spamming unauthorized channels with typing indicators
        if (!channelId || !socket.rooms.has(channelId)) {
            return; // Silently discard unauthorized or invalid attempts
        }

        if (!typingUsers.has(channelId)) {
            typingUsers.set(channelId, new Set());
        }

        typingUsers.get(channelId).add(socket.user._id.toString());

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
            typingUsers.get(channelId).delete(socket.user._id.toString());
        }

        socket.to(channelId).emit("user_typing_stop", {
            channelId,
            userId: socket.user._id.toString()
        });
    });
}