export function formatMessageDTO(message) {
    // Pick whichever has the username, falling back to raw IDs
    const sender = 
        (message.sender && typeof message.sender === "object" && message.sender.username ? message.sender : null) ||
        (message.user && typeof message.user === "object" && message.user.username ? message.user : null) ||
        message.sender ||
        message.user ||
        message.UserId ||
        null;

    const senderId = 
        sender?._id?.toString() || 
        (typeof sender === "string" ? sender : sender?.toString?.() || null);

    const senderUsername = sender?.username || null;
    const senderAvatar = sender?.avatar || null;

    return {
        id: (message._id || message.id).toString(),
        content: message.content,
        senderId,
        senderUsername,
        senderAvatar,
        channelId:
            message.channelId?.toString?.() ||
            message.channel?.toString?.() ||
            message.channel,
        sequence: message.sequence,
        timestamp: message.createdAt
            ? (message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt)
            : new Date().toISOString(),
        isEdited: Boolean(message.isEdited),
        editedAt: message.editedAt ? new Date(message.editedAt).toISOString() : null,
        isSystemMessage: Boolean(message.isSystemMessage),
        clientId: message.clientId || null
    };
}