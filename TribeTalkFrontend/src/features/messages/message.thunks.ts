// features/messages/message.thunks.ts (FIXED - string channel IDs)
import { createAsyncThunk } from "@reduxjs/toolkit"
import { setMessagesForChannel } from "./message.slice"
import type { RootState } from "../../app/store"
import type { Message } from "../types"

// Default mock messages
const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    content: "Welcome to the channel!",
    senderId: "101",
    channelId: "1",  // FIXED: now string
    timestamp: new Date().toISOString(),
    sequence: 1,
    isEdited: false,
  },
  {
    id: "2",
    content: "Hello everyone 👋",
    senderId: "102",
    channelId: "1",  // FIXED: now string
    timestamp: new Date().toISOString(),
    sequence: 2,
    isEdited: false,
  },
  {
    id: "3",
    content: "This is a mock message.",
    senderId: "103",
    channelId: "1",  // FIXED: now string
    timestamp: new Date().toISOString(),
    sequence: 3,
    isEdited: false,
  },
]

// Async thunk to fetch messages for a channel
export const fetchMessagesForChannel = createAsyncThunk<
  Message[],
  string,  // FIXED: channelId is now string
  { state: RootState }
>(
  "message/fetchMessagesForChannel",
  async (channelId, { dispatch, getState }) => {
    const state = getState()
    const cached = state.message.messagesByChannel[channelId]
    if (cached && cached.length > 0) {
      // Already cached, return early
      return cached
    }

    // Since backend is not setup, return mock messages instead
    const mockMessages = MOCK_MESSAGES.map((msg) => ({
      ...msg,
      id: `${msg.id}-${channelId}`,
      channelId,
      timestamp: new Date().toISOString(),
    }))

    // Update slice
    dispatch(setMessagesForChannel({ channelId, messages: mockMessages }))

    return mockMessages

    /*
    // Real backend code (commented out for now)
    return socketGateway
      .getMessagesForChannel(channelId)
      .then((messages) => {
        dispatch(setMessagesForChannel({ channelId, messages }))
        return messages
      })
      .catch((err) => {
        console.error("Failed to fetch messages:", err)
        throw err
      })
    */
  }
)
