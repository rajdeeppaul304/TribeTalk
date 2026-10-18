//channel.braodcaster.js
import { eventBus } from "../../events/eventBus.js";
import { EVENTS } from "../../events/eventNames.js";
import { formatMessageDTO } from "../socket.utils.js";

export function initChannelBroadcaster(io) {
  eventBus.on(EVENTS.CHANNEL_CREATED, ({ channel, serverId }) => {
    console.log(`📡 Broadcasting channel_created for server ${serverId}: ${channel.name}`);
    io.to(`server:${serverId}`).emit("channel_created", {
      channel,
      serverId: serverId.toString(),
    });
  });
  eventBus.on(EVENTS.SCHEDULED_MESSAGE_READY, ({ message }) => {
    io.to(message.channel.toString()).emit("new_message", formatMessageDTO(message));
  });
}
