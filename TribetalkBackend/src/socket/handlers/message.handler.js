// message.handler.js

import * as messageService from "../../Service/Message.service.js";
import * as channelService from "../../Service/Channel.service.js";

import { formatMessageDTO } from "../socket.utils.js";

export default function registerMessageHandlers(io, socket) {
    socket.on("send_message", async ({ channelId, content, clientId = null }) => {
        try {
            const user = socket.user;

            const savedMessage = await messageService.addMessage({
                content,
                channelId,
                UserId: user._id,
                clientId
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

            socket.emit("new_message", messageDTO);

            socket.to(channelId).emit("new_message", {
                ...messageDTO,
                clientId: null
            });

            // 🔧 FIX: scope to the server room, not a global broadcast
            const serverId = await channelService.channelActivity({ channelId });
            io.to(`server:${serverId}`).emit("channel_activity", {
                channelId,
                serverId: serverId.toString()
            });
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