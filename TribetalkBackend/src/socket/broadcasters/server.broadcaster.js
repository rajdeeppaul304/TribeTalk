import { eventBus } from "../../events/eventBus.js";
import { EVENTS } from "../../events/eventNames.js";

export function initServerBroadcaster(io, sessionManager) {
    eventBus.on(EVENTS.SERVER_MEMBER_JOINED, ({ serverId, userId }) => {
        const socketIds = sessionManager.getUserSockets(userId.toString());

        socketIds.forEach((socketId) => {
            const memberSocket = io.sockets.sockets.get(socketId);
            if (memberSocket) {
                memberSocket.join(`server:${serverId}`);
                console.log(`📡 Socket ${socketId} joined server:${serverId}`);
            }
        });
    });
}