import { baseApi } from "../api/baseApi"
import type { MessageSearchResult } from "../types"

type ApiResponse<T> = { statusCode: number; data: T; message: string; success: boolean }

export const searchApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    searchMessages: builder.query<MessageSearchResult[], { query: string; limit?: number }>({
      query: ({ query, limit = 20 }) => `/search/messages?q=${encodeURIComponent(query)}&limit=${limit}`,
      transformResponse: (response: ApiResponse<MessageSearchResult[]>) => response.data,
    }),
  }),
})

export const { useLazySearchMessagesQuery } = searchApi
