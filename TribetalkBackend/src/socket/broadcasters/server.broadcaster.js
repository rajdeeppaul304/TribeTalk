import { eventBus } from "../../events/eventBus.js";
import { EVENTS } from "../../events/eventNames.js";

export function initServerBroadcaster(io) {
    eventBus.on(EVENTS.SERVER_MEMBER_JOINED, ({ serverId, userId }) => {
        // `socketsJoin` is propagated through the Redis adapter, so this also
        // reaches sockets connected to other backend instances.
        io.in(`user:${userId}`).socketsJoin(`server:${serverId}`);
        console.log(`📡 User ${userId} joined server:${serverId}`);
    });
}
