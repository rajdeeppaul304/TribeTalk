//channel.braodcaster.js
import { eventBus } from "../../events/eventBus.js";
import { EVENTS } from "../../events/eventNames.js";

export function initChannelBroadcaster(io) {
  eventBus.on(EVENTS.CHANNEL_CREATED, ({ channel, serverId }) => {
    console.log(`📡 Broadcasting channel_created for server ${serverId}: ${channel.name}`);
    io.to(`server:${serverId}`).emit("channel_created", {
      channel,
      serverId: serverId.toString(),
    });
  });
}