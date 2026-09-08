//gateway.js
import SessionManager from "./SessionManager.js";
import { socketAuthMiddleware, channelGuardMiddleware } from "./socket.middleware.js";
import { initChannelBroadcaster } from "./broadcasters/channel.broadcaster.js";
import { initServerBroadcaster } from "./broadcasters/server.broadcaster.js";
import registerChannelHandlers from "./handlers/channel.handler.js";
import registerMessageHandlers from "./handlers/message.handler.js";
import registerSyncHandlers from "./handlers/sync.handler.js";
import * as serverService from "../Service/Server.service.js";

const typingUsers = new Map(); // channelId -> Set of userIds

export default function setupGateway(io) {
    const sessionManager = new SessionManager();

    // 📡 Initialize outbound only broadcasters
    initChannelBroadcaster(io);
    initServerBroadcaster(io, sessionManager);

    io.use(socketAuthMiddleware);

    io.on("connection", async (socket) => {
        console.log(`✅ Socket connected: ${socket.id} | User: ${socket.user._id}`);
        sessionManager.addUser(socket.user._id.toString(), socket.id);

        // Join every server room this user belongs to
        try {
            const serverIds = await serverService.getServerRoomIds(socket.user._id);
            serverIds.forEach((id) => socket.join(`server:${id}`));
        } catch (err) {
            console.error("❌ Failed to join server rooms on connect:", err);
        }

        socket.use(channelGuardMiddleware(socket));
        socket.on("error", (err) => {
            socket.emit("error", { message: err.message });
        });

        registerChannelHandlers(io, socket, typingUsers);
        registerMessageHandlers(io, socket);
        registerSyncHandlers(io, socket);

        socket.on("disconnect", () => {
            console.log(`❌ Socket disconnected: ${socket.id} | User: ${socket.user._id}`);

            for (const [channelId, users] of typingUsers.entries()) {
                if (users.delete(socket.user._id.toString())) {
                    io.to(channelId).emit("user_typing_stop", {
                        channelId,
                        userId: socket.user._id.toString()
                    });
                }
            }
            sessionManager.removeSocket(socket.id);
        });
    });
}