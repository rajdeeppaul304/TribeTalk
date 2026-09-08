// features/messages/message.slice.ts
import { createSlice } from "@reduxjs/toolkit"
import type { PayloadAction } from "@reduxjs/toolkit"
import type { Message, MessageState } from "../types"

const MAX_MESSAGES_PER_CHANNEL = 100

// Helper to get identifier regardless of whether it's 'id' or '_id'
const getMsgKey = (m: any): string => m?.id || m?._id || m?.clientId || ""

const initialState: MessageState = {
  messagesByChannel: {},
  editingMessageId: null,
  typingUsers: {},
}

const messageSlice = createSlice({
  name: "message",
  initialState,
  reducers: {
    /**
     * Merge initial REST messages with existing in-flight socket messages
     */
    setMessagesForChannel(
      state,
      action: PayloadAction<{ channelId: string; messages: Message[] }>
    ) {
      const { channelId, messages: restMessages } = action.payload
      const existingLiveMessages = state.messagesByChannel[channelId] || []

      // Map keyed by unique message identifier
      const messageMap = new Map<string, Message>()

      // 1. Seed with historical REST messages
      for (const msg of restMessages) {
        const key = getMsgKey(msg)
        if (key) messageMap.set(key, msg)
      }

      // 2. Merge existing live socket messages on top (preserving in-flight/newer items)
      for (const msg of existingLiveMessages) {
        const key = getMsgKey(msg)
        if (key) messageMap.set(key, msg)
      }

      // 3. Sort strictly by sequence and trim window
      state.messagesByChannel[channelId] = Array.from(messageMap.values())
        .sort((a, b) => a.sequence - b.sequence)
        .slice(-MAX_MESSAGES_PER_CHANNEL)
    },

    /**
     * Prepend older messages (for infinite scroll up)
     */
    prependMessages(
      state,
      action: PayloadAction<{ channelId: string; messages: Message[] }>
    ) {
      const { channelId, messages } = action.payload
      if (!state.messagesByChannel[channelId]) {
        state.messagesByChannel[channelId] = []
      }

      const existing = state.messagesByChannel[channelId]
      const newMessages = messages.filter((msg) => {
        const targetKey = getMsgKey(msg)
        return !existing.some((m) => getMsgKey(m) === targetKey)
      })

      state.messagesByChannel[channelId] = [...newMessages, ...existing]
        .sort((a, b) => a.sequence - b.sequence)
        .slice(-MAX_MESSAGES_PER_CHANNEL)
    },

    /**
     * Add a single message (real-time or optimistic)
     */
    addMessage(
      state,
      action: PayloadAction<{ channelId: string; message: Message }>
    ) {
      const { channelId, message } = action.payload
      if (!state.messagesByChannel[channelId]) {
        state.messagesByChannel[channelId] = []
      }

      const messages = state.messagesByChannel[channelId]
      const incomingKey = getMsgKey(message)

      // Deduplicate against id, _id, or matching clientId
      const exists = messages.some((m) => {
        return (
          getMsgKey(m) === incomingKey ||
          (message.clientId && m.clientId === message.clientId)
        )
      })

      if (!exists) {
        messages.push(message)
        messages.sort((a, b) => a.sequence - b.sequence)

        if (messages.length > MAX_MESSAGES_PER_CHANNEL) {
          state.messagesByChannel[channelId] = messages.slice(-MAX_MESSAGES_PER_CHANNEL)
        }
      }
    },

    /**
     * Replace optimistic message with real one from server
     */
    replaceMessage(
      state,
      action: PayloadAction<{ channelId: string; clientId: string; message: Message }>
    ) {
      const { channelId, clientId, message } = action.payload
      const messages = state.messagesByChannel[channelId]
      if (!messages) return

      const index = messages.findIndex((m) => m.clientId === clientId)
      if (index !== -1) {
        messages[index] = message
      } else {
        // Fallback: If not found by clientId, check by key or append
        const key = getMsgKey(message)
        const keyIndex = messages.findIndex((m) => getMsgKey(m) === key)
        if (keyIndex !== -1) {
          messages[keyIndex] = message
        } else {
          messages.push(message)
          messages.sort((a, b) => a.sequence - b.sequence)
        }
      }
    },

    /**
     * Update an existing message (edit)
     */
    editMessage(
      state,
      action: PayloadAction<{ channelId: string; message: Message }>
    ) {
      const { channelId, message } = action.payload
      const messages = state.messagesByChannel[channelId]
      if (!messages) return

      const targetKey = getMsgKey(message)
      const index = messages.findIndex((m) => getMsgKey(m) === targetKey)
      if (index !== -1) {
        messages[index] = message
      }
    },

    /**
     * Delete a message from a channel
     */
    deleteMessage(
      state,
      action: PayloadAction<{ channelId: string; messageId: string }>
    ) {
      const { channelId, messageId } = action.payload
      const messages = state.messagesByChannel[channelId]
      if (!messages) return

      const index = messages.findIndex((m) => getMsgKey(m) === messageId)
      if (index !== -1) {
        messages[index] = {
          ...messages[index],
          content: "[Message deleted]",
          deletedAt: new Date().toISOString(),
        }
      }
    },

    /**
     * Mark a message as failed
     */
    markMessageFailed(
      state,
      action: PayloadAction<{ channelId: string; clientId: string }>
    ) {
      const { channelId, clientId } = action.payload
      const messages = state.messagesByChannel[channelId]
      if (!messages) return

      const message = messages.find((m) => m.clientId === clientId)
      if (message) {
        message.isFailed = true
        message.isPending = false
      }
    },

    /**
     * Set which message is being edited
     */
    setEditingMessage(state, action: PayloadAction<string | null>) {
      state.editingMessageId = action.payload
    },

    /**
     * Add typing user to a channel
     */
    addTypingUser(
      state,
      action: PayloadAction<{ channelId: string; userId: string; username: string }>
    ) {
      const { channelId, userId, username } = action.payload
      if (!state.typingUsers[channelId]) {
        state.typingUsers[channelId] = {}
      }
      state.typingUsers[channelId][userId] = username
    },

    /**
     * Remove typing user from a channel
     */
    removeTypingUser(
      state,
      action: PayloadAction<{ channelId: string; userId: string }>
    ) {
      const { channelId, userId } = action.payload
      if (state.typingUsers[channelId]) {
        delete state.typingUsers[channelId][userId]
      }
    },
    /**
     * Clear all messages for a channel
     */
    clearChannelMessages(state, action: PayloadAction<string>) {
      delete state.messagesByChannel[action.payload]
      delete state.typingUsers[action.payload]
    },
  },
})

export const {
  setMessagesForChannel,
  prependMessages,
  addMessage,
  replaceMessage,
  editMessage,
  deleteMessage,
  markMessageFailed,
  setEditingMessage,
  addTypingUser,
  removeTypingUser,
  clearChannelMessages,
} = messageSlice.actions

export default messageSlice.reducer