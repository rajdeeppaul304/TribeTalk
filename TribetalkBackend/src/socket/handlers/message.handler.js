import * as messageService from "../../Service/Message.service.js";
import { formatMessageDTO } from "../socket.utils.js";

export default function registerMessageHandlers(io, socket) {
    // Send message
    socket.on("send_message", async ({ channelId, content, clientId = null }) => {
    try {
        const user = socket.user;

        const savedMessage = await messageService.addMessage({
            content,
            channelId,
            UserId: user._id,
            clientId
        });

        // Attach sender as an object with username and avatar
        const messageWithUser = {
            ...(savedMessage.toObject ? savedMessage.toObject() : savedMessage),
            sender: {
                _id: user._id,
                username: user.username,
                avatar: user.avatar
            }
        };

        const messageDTO = formatMessageDTO(messageWithUser);

        // Echo back to sender
        socket.emit("new_message", messageDTO);

        // Broadcast to room members without clientId
        socket.to(channelId).emit("new_message", {
            ...messageDTO,
            clientId: null
        });

        io.emit("channel_activity", { channelId });
    } catch (error) {
        console.error("❌ Error in send_message:", error);
        socket.emit("error", {
            message: "Failed to send message",
            clientId
        });
    }
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