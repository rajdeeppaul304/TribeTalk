// gateway/socket.ts (UPDATED)
import { io, Socket } from "socket.io-client"
import type { Channel, Message, SyncState, TypingIndicator } from "../features/types"
import { env } from "../config/env"

class SocketGateway {
  private socket: Socket | null = null

  connect(token: string) {
    this.socket?.disconnect()
    this.socket = io(env.socketUrl, {
      auth: { token }
    })
  }

  private getSocket(): Socket {
    if (!this.socket) {
      throw new Error("Socket not connected")
    }
    return this.socket
  }

  // ======================
  // Channel Events
  // ======================

  joinChannel(channelId: string, lastKnownSequence?: number) {
    const socket = this.getSocket()
    socket.emit("join_channel", { channelId, lastKnownSequence })
  }

  leaveChannel(channelId: string) {
    const socket = this.getSocket()
    socket.emit("leave_channel", { channelId })
  }

  // ======================
  // Message Events
  // ======================

  sendMessage(payload: { channelId: string; content: string; clientId?: string }) {
    const socket = this.getSocket()
    socket.emit("send_message", payload)
  }

  editMessage(messageId: string, content: string) {
    const socket = this.getSocket()
    socket.emit("edit_message", { messageId, content })
  }

  deleteMessage(messageId: string) {
    const socket = this.getSocket()
    socket.emit("delete_message", { messageId })
  }

  // ======================
  // Typing Events
  // ======================

  startTyping(channelId: string) {
    const socket = this.getSocket()
    socket.emit("typing_start", { channelId })
  }

  stopTyping(channelId: string) {
    const socket = this.getSocket()
    socket.emit("typing_stop", { channelId })
  }

  // ======================
  // Read Events
  // ======================

  markAsRead(channelId: string, lastReadMessageId?: string) {
    const socket = this.getSocket()
    socket.emit("mark_read", { channelId, lastReadMessageId })
  }

  getUnreadCounts() {
    const socket = this.getSocket()
    console.log("get unread count called")
    socket.emit("get_unread_counts",)

  }



  // ======================
  // Sync Events
  // ======================

  requestSync(channelId: string, lastReceivedSequence: number) {
    const socket = this.getSocket()
    socket.emit("request_sync", { channelId, lastReceivedSequence })
  }

  // ======================
  // Incoming Events
  // ======================

  onSyncState(handler: (data: SyncState) => void) {
    this.socket?.on("sync_state", handler)
  }

  onMissedMessages(handler: (data: { channelId: string; messages: Message[] }) => void) {
    this.socket?.on("missed_messages", handler)
  }

  onNewMessage(handler: (message: Message) => void) {
    this.socket?.on("new_message", handler)
  }

  onMessageUpdated(handler: (message: Message) => void) {
    this.socket?.on("message_updated", handler)
  }

  onMessageDeleted(handler: (data: { channelId: string; messageId: string; message: Message }) => void) {
    this.socket?.on("message_deleted", handler)
  }

  onUserTyping(handler: (data: TypingIndicator) => void) {
    this.socket?.on("user_typing", handler)
  }

  onUserTypingStop(handler: (data: { channelId: string; userId: string }) => void) {
    this.socket?.on("user_typing_stop", handler)
  }

  onSyncMessages(handler: (data: { channelId: string; messages: Message[] }) => void) {
    this.socket?.on("sync_messages", handler)
  }

  onChannelCreated(handler: (data: { channel: Channel; serverId: string }) => void) {
    this.socket?.on("channel_created", handler)
  }

  offChannelCreated(handler: (data: { channel: Channel; serverId: string }) => void) {
    this.socket?.off("channel_created", handler)
  }

  // onChannelActivity(handler: (data: {channelId: string}) => void) {
  //   this.socket?.on("channel_activity", 
  //     // (data)=>{
  //     // console.log("channelActivity",data)
  //     handler(data)
  //   })
  // }
  onChannelActivity(handler: (data: { channelId: string }) => void) {
    this.socket?.on("channel_activity", handler)
  }

  offChannelActivity(handler: (data: { channelId: string }) => void) {
    this.socket?.off("channel_activity", handler)
  }


  onError(handler: (data: { message: string; clientId?: string }) => void) {
    this.socket?.on("error", handler)
  }
  onUnreadCounts(handler: (data: { [channelId: string]: number }) => void) {
    this.socket?.on("unread_counts", (data) => {
      console.log("Unread counts received:", data);
      handler(data);
    });
  }


  // ======================
  // Connection Events
  // ======================

  onConnect(handler: () => void) {
    this.socket?.on("connect", handler)
  }

  onDisconnect(handler: () => void) {
    this.socket?.on("disconnect", handler)
  }

  // ======================
  // Cleanup
  // ======================

  off(event: string, handler?: (...args: unknown[]) => void) {
    this.socket?.off(event, handler)
  }

  offUnreadCounts(handler: (data: { [channelId: string]: number }) => void) {
    this.socket?.off("unread_counts", handler)
  }



  disconnect() {
    this.socket?.disconnect()
  }
}

export const socketGateway = new SocketGateway()
