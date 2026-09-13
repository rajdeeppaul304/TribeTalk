import * as messageService from "../../Service/Message.service.js";
import { formatMessageDTO } from "../socket.utils.js";

export default function registerSyncHandlers(io, socket) {
    // Unread counts badge sync
    socket.on("get_unread_counts", async () => {
        try {
            const unreadCounts = await messageService.getUnreadCountsForUser(socket.user._id);
            socket.emit("unread_counts", unreadCounts);
        } catch (error) {
            console.error("❌ Error in get_unread_counts:", error);
            socket.emit("error", { message: "Failed to get unread counts" });
        }
    });

    // Mark channel as read
    socket.on("mark_read", async ({ channelId, lastReadMessageId }) => {
        try {
            await messageService.markAsRead(
                socket.user._id,
                channelId,
                lastReadMessageId
            );
        } catch (error) {
            console.error("❌ Error in mark_read:", error);
        }
    });

    // Reconnect/sync recovery
    socket.on("request_sync", async ({ channelId, lastReceivedSequence }) => {
        try {
            const missedMessages = await messageService.getMissedMessages(
                channelId,
                lastReceivedSequence,
                socket.user._id
            );

            socket.emit("sync_messages", {
                channelId,
                messages: missedMessages.map(msg => formatMessageDTO(msg))
            });
        } catch (error) {
            console.error("❌ Error in request_sync:", error);
            socket.emit("error", { message: "Failed to sync messages" });
        }
    });
}
