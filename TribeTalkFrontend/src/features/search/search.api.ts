import { baseApi } from "../api/baseApi"
import type { MessageSearchResult } from "../types"

type ApiResponse<T> = { statusCode: number; data: T; message: string; success: boolean }

export const searchApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    searchMessages: builder.query<MessageSearchResult[], { query: string; limit?: number; channelId?: string; senderId?: string; from?: string; to?: string; hasAttachments?: boolean }>({
      query: ({ query, limit = 20, channelId, senderId, from, to, hasAttachments }) => {
        const params = new URLSearchParams({ q: query, limit: String(limit) })
        if (channelId) params.set("channelId", channelId)
        if (senderId) params.set("senderId", senderId)
        if (from) params.set("from", from)
        if (to) params.set("to", to)
        if (hasAttachments !== undefined) params.set("hasAttachments", String(hasAttachments))
        return `/search/messages?${params.toString()}`
      },
      transformResponse: (response: ApiResponse<MessageSearchResult[]>) => response.data,
    }),
  }),
})

export const { useLazySearchMessagesQuery } = searchApi
