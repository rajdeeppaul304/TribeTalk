//gateway.js
import { socketAuthMiddleware, channelGuardMiddleware } from "./socket.middleware.js";
import { initChannelBroadcaster } from "./broadcasters/channel.broadcaster.js";
import { initServerBroadcaster } from "./broadcasters/server.broadcaster.js";
import registerChannelHandlers from "./handlers/channel.handler.js";
import registerMessageHandlers from "./handlers/message.handler.js";
import registerSyncHandlers from "./handlers/sync.handler.js";
import * as serverService from "../Service/Server.service.js";
import { createAdapter } from "@socket.io/redis-adapter";
import { markSocketOffline, markSocketOnline, refreshSocketPresence } from "../config/redis.js";
import { User } from "../Models/User.model.js";
import { socketEventMiddleware } from "./event.middleware.js";
import { metrics } from "../config/metrics.js";
import { logger } from "../config/logger.js";

const typingUsers = new Map(); // channelId -> Set of userIds

export default function setupGateway(io, redisClients = null) {
    if (redisClients) {
        io.adapter(createAdapter(redisClients.pubClient, redisClients.subClient));
        console.log("✅ Socket.IO Redis adapter enabled");
    }
    // 📡 Initialize outbound only broadcasters
    initChannelBroadcaster(io);
    initServerBroadcaster(io);

    io.use(socketAuthMiddleware);

    io.on("connection", async (socket) => {
        logger.info({ socketId: socket.id, userId: socket.user._id }, "Socket connected");
        metrics.increment("socketConnections"); metrics.increment("activeSockets");
        const userId = socket.user._id.toString();
        socket.join(`user:${userId}`);
        void markSocketOnline(userId, socket.id).then(async (becameOnline) => {
            if (!becameOnline) return;
            const serverIds = await serverService.getServerRoomIds(userId);
            serverIds.forEach((id) => io.to(`server:${id}`).emit("presence_changed", { userId, online: true, lastSeenAt: null }));
        });

        socket.on("presence_heartbeat", () => {
            void refreshSocketPresence(userId, socket.id);
        });

        // Join every server room this user belongs to
        try {
            const serverIds = await serverService.getServerRoomIds(socket.user._id);
            serverIds.forEach((id) => socket.join(`server:${id}`));
        } catch (err) {
            console.error("❌ Failed to join server rooms on connect:", err);
        }

        socket.use(channelGuardMiddleware(socket));
        socket.use(socketEventMiddleware(socket));
        socket.on("error", (err) => {
            socket.emit("error", { message: err.message });
        });

        registerChannelHandlers(io, socket, typingUsers);
        registerMessageHandlers(io, socket);
        registerSyncHandlers(io, socket);

        socket.on("disconnect", () => {
            logger.info({ socketId: socket.id, userId: socket.user._id }, "Socket disconnected");
            metrics.decrement("activeSockets");

            for (const [channelId, users] of typingUsers.entries()) {
                const timer = users.get(socket.user._id.toString());
                if (timer) clearTimeout(timer);
                if (users.delete(socket.user._id.toString())) {
                    io.to(channelId).emit("user_typing_stop", {
                        channelId,
                        userId: socket.user._id.toString()
                    });
                }
            }
            void markSocketOffline(userId, socket.id).then(async (becameOffline) => {
                if (!becameOffline) return;
                const lastSeenAt = new Date();
                await User.findByIdAndUpdate(userId, { $set: { lastSeenAt } });
                const serverIds = await serverService.getServerRoomIds(userId);
                serverIds.forEach((id) => io.to(`server:${id}`).emit("presence_changed", { userId, online: false, lastSeenAt }));
            });
        });
    });
}
