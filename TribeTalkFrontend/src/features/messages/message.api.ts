// features/messages/message.api.ts
import { baseApi } from "../api/baseApi"
import type { Message, MessageAttachment } from "../types"

type ApiResponse<T> = {
  statusCode: number
  data: T
  message: string
  success?: boolean
}

type BackendSender = {
  _id: string
  username?: string
  avatar?: string
}

type BackendMessage = {
  _id: string
  content: string
  sender: BackendSender | string
  channel: string
  sequence: number
  createdAt: string
  isEdited: boolean
  editedAt?: string | null
  isSystemMessage?: boolean
  clientId?: string | null
  attachments?: MessageAttachment[]
}

export const messageApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get message history (cursor-based pagination)
    getMessageHistory: builder.query<
      { messages: Message[]; hasMore: boolean; cursor: string | null },
      { channelId: string; limit?: number; before?: string; after?: string }
    >({
      query: ({ channelId, limit = 50, before, after }) => {
        const params = new URLSearchParams({ limit: limit.toString() })
        if (before) params.append("before", before)
        if (after) params.append("after", after)
        return `/messages/${channelId}/messages?${params.toString()}`
      },
      transformResponse: (response: ApiResponse<{
        messages: BackendMessage[]
        hasMore: boolean
        cursor: string | null
      }>) => {
        // Transform backend message format to frontend format
        const messages = response.data.messages.map((msg) => {
          const sender = typeof msg.sender === "string" ? { _id: msg.sender } : msg.sender
          return {
          id: msg._id,
          content: msg.content,
          senderId: sender._id,
          senderUsername: sender.username || undefined,
          senderAvatar: sender.avatar || undefined,
          channelId: msg.channel,
          sequence: msg.sequence,
          timestamp: msg.createdAt,
          isEdited: msg.isEdited,
          editedAt: msg.editedAt || undefined,
          isSystemMessage: msg.isSystemMessage || false,
          clientId: msg.clientId || undefined,
          attachments: msg.attachments || [],
          }
        })
        return {
          messages,
          hasMore: response.data.hasMore,
          cursor: response.data.cursor,
        }
      },
    }),

    // Get sync data for a channel
    getChannelSyncData: builder.query<
      { latestMessageId: string | null; latestSequence: number; unreadCount: number },
      string
    >({
      query: (channelId) => `/messages/${channelId}/sync`,
      transformResponse: (response: ApiResponse<{
        latestMessageId: string | null
        latestSequence: number
        unreadCount: number
      }>) => response.data,
    }),

    // Mark channel as read
    markChannelAsRead: builder.mutation<
      void,
      { channelId: string; lastReadMessageId?: string }
    >({
      query: ({ channelId, lastReadMessageId }) => ({
        url: `/messages/${channelId}/mark-read`,
        method: "POST",
        body: { lastReadMessageId },
      }),
    }),
  }),
})

export const {
  useGetMessageHistoryQuery,
  useLazyGetMessageHistoryQuery,
  useGetChannelSyncDataQuery,
  useMarkChannelAsReadMutation,
} = messageApi
