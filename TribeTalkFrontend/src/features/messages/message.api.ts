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
  replyTo?: string | null
  threadRoot?: string | null
  reactions?: { emoji: string; users: string[] }[]
  pinnedAt?: string | null
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
          replyTo: msg.replyTo || null,
          threadRoot: msg.threadRoot || null,
          reactions: (msg.reactions || []).map((reaction) => ({ emoji: reaction.emoji, userIds: reaction.users || [] })),
          pinnedAt: msg.pinnedAt || null,
          }
        })
        return {
          messages,
          hasMore: response.data.hasMore,
          cursor: response.data.cursor,
        }
      },
    }),
    getMessageById: builder.query<Message, { channelId: string; messageId: string }>({
      query: ({ channelId, messageId }) => `/messages/${channelId}/messages/by-id/${messageId}`,
      transformResponse: (response: ApiResponse<BackendMessage>) => {
        const sender = typeof response.data.sender === "string" ? { _id: response.data.sender } : response.data.sender
        return { id: response.data._id, content: response.data.content, senderId: sender._id, senderUsername: sender.username, senderAvatar: sender.avatar, channelId: response.data.channel, sequence: response.data.sequence, timestamp: response.data.createdAt, createdAt: response.data.createdAt, isEdited: response.data.isEdited, editedAt: response.data.editedAt || undefined, attachments: response.data.attachments || [], replyTo: response.data.replyTo || null, threadRoot: response.data.threadRoot || null, reactions: (response.data.reactions || []).map((reaction) => ({ emoji: reaction.emoji, userIds: reaction.users || [] })), pinnedAt: response.data.pinnedAt || null }
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
  useLazyGetMessageByIdQuery,
  useGetChannelSyncDataQuery,
  useMarkChannelAsReadMutation,
} = messageApi
