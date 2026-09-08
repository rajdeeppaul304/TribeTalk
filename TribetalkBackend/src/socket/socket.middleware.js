// socket.middleware.js
import { getUserFromToken } from "../Middlewares/Auth.middleware.js";
import { checkChannelAccess } from "../Service/Permission.service.js";

// Events that require channel access verification
const CHANNEL_GUARDED_EVENTS = new Set([
    "join_channel",
    "send_message",
    "mark_read",
    "request_sync"
]);

/**
 * Handshake Authentication Middleware
 */
export async function socketAuthMiddleware(socket, next) {
    try {
        let token = socket.handshake.auth?.token;

        if (!token) {
            const authHeader = socket.handshake.headers?.authorization;
            if (authHeader?.startsWith("Bearer ")) {
                token = authHeader.split(" ")[1];
            }
        }

        if (!token) {
            return next(new Error("Authentication token missing"));
        }

        const user = await getUserFromToken(token);
        if (!user) {
            return next(new Error("Invalid token"));
        }

        socket.user = user;
        next();
    } catch (err) {
        next(new Error("Authentication failed"));
    }
}

/**
 * Packet Middleware: Guards channel operations
 */
export function channelGuardMiddleware(socket) {
    return async ([event, payload], next) => {
        if (!CHANNEL_GUARDED_EVENTS.has(event)) {
            return next();
        }

        const channelId = payload?.channelId;
        if (!channelId) {
            return next(new Error(`channelId is required for event: ${event}`));
        }

        const hasAccess = await checkChannelAccess(socket.user._id, channelId);
        if (!hasAccess) {
            return next(new Error("Access denied to this channel"));
        }

        next();
    };
}