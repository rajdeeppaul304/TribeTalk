// features/messages/socketMessageSync.ts (UPDATED)
import { socketGateway } from "../../gateway/socket"
import {
  addMessage,
  replaceMessage,
  editMessage,
  deleteMessage,
  addTypingUser,
  removeTypingUser,
} from "./message.slice"
import type { AppDispatch } from "../../app/store"

/**
 * Initialize all socket listeners for real-time messaging
 * Call this once on app mount after authentication
 */
export function initializeMessageSync(dispatch: AppDispatch) {
  
  // ============================================
  // SYNC & INITIAL STATE
  // ============================================

  /**
   * Receive sync state when joining a channel
   */
  socketGateway.onSyncState((data) => {
    console.log("📊 Sync state received:", data)
    // Store in Redux if needed for unread badges, etc.
  })

  /**
   * Receive messages missed while offline
   */
  socketGateway.onMissedMessages((data) => {
    console.log(`📦 Received ${data.messages.length} missed messages`)
    
    // Add all missed messages to Redux
    data.messages.forEach((message) => {
      dispatch(addMessage({ channelId: data.channelId, message }))
    })
  })

  /**
   * Receive sync messages (from request_sync)
   */
  socketGateway.onSyncMessages((data) => {
    console.log(`🔄 Synced ${data.messages.length} messages`)
    
    data.messages.forEach((message) => {
      dispatch(addMessage({ channelId: data.channelId, message }))
    })
  })

  // ============================================
  // MESSAGE EVENTS
  // ============================================

  /**
   * New message received (real-time or echo of own message)
   */
  socketGateway.onNewMessage((message) => {
    console.log("✅ New message received:", message)

    // If this is an echo of our optimistic message, replace it
    if (message.clientId) {
      dispatch(
        replaceMessage({
          channelId: message.channelId,
          clientId: message.clientId,
          message,
        })
      )
    } else {
      // It's from someone else
      dispatch(addMessage({ channelId: message.channelId, message }))
    }
  })

  /**
   * Message was edited
   */
  socketGateway.onMessageUpdated((message) => {
    console.log("✏️ Message updated:", message.id)
    dispatch(editMessage({ channelId: message.channelId, message }))
  })

  /**
   * Message was deleted
   */
  socketGateway.onMessageDeleted((data) => {
    console.log("🗑️ Message deleted:", data.messageId)
    dispatch(
      deleteMessage({
        channelId: data.channelId,
        messageId: data.messageId,
      })
    )
  })

  // ============================================
  // TYPING INDICATORS
  // ============================================

  /**
   * User started typing
   */
  socketGateway.onUserTyping((data) => {
    console.log(`⌨️ ${data.username} is typing in ${data.channelId}`)
    dispatch(
      addTypingUser({
        channelId: data.channelId,
        userId: data.userId,
        username: data.username,
      })
    )
  })

  /**
   * User stopped typing
   */
  socketGateway.onUserTypingStop((data) => {
    console.log(`⌨️ User stopped typing in ${data.channelId}`)
    dispatch(
      removeTypingUser({
        channelId: data.channelId,
        userId: data.userId,
      })
    )
  })

  // ============================================
  // ERROR HANDLING
  // ============================================

  /**
   * Socket error (e.g., failed to send message)
   */
  socketGateway.onError((error) => {
    console.error("❌ Socket error:", error.message)

    // If error relates to a specific message (clientId provided)
    if (error.clientId) {
      // Mark the optimistic message as failed
      // We'll need to get channelId from somewhere - store it when sending
    }
  })

  // ============================================
  // CONNECTION EVENTS
  // ============================================

  socketGateway.onConnect(() => {
    console.log("✅ Socket connected")
    // You can dispatch a reconnect action here if needed
  })

  socketGateway.onDisconnect(() => {
    console.log("❌ Socket disconnected")
    // You can show an "offline" indicator here
  })
}

/**
 * Cleanup all socket listeners
 * Call this on logout or app unmount
 */
export function cleanupMessageSync() {
  socketGateway.off("sync_state")
  socketGateway.off("missed_messages")
  socketGateway.off("sync_messages")
  socketGateway.off("new_message")
  socketGateway.off("message_updated")
  socketGateway.off("message_deleted")
  socketGateway.off("user_typing")
  socketGateway.off("user_typing_stop")
  socketGateway.off("error")
  socketGateway.off("connect")
  socketGateway.off("disconnect")
}
