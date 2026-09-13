// features/channels/channel.api.ts (FIXED)
import { baseApi } from "../api/baseApi"
import type { Channel } from "../types"

type ApiResponse<T> = {
  statusCode: number
  data: T
  message: string
  success?: boolean
}

export const channelApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Create a new channel
    createChannel: builder.mutation<
      Channel, 
      { name: string; serverId: string; description?: string }
    >({
      query: (body) => ({
        url: "/channels/create-channel",
        method: "POST",
        body,
      }),
      transformResponse: (response: ApiResponse<Channel>) => response.data,
      // FIXED: Invalidate both the server details AND the channel list
      invalidatesTags: (_result, _error, { serverId }) => [
        { type: "Servers", id: serverId },  // refetch server (which includes channels)
        { type: "Channels", id: "LIST" },   // refetch any channel lists
      ],
    }),

    // Get channel info by ID
    getChannelById: builder.query<Channel, string>({
      query: (channelId) => `/channels/channel-info/${channelId}`,
      transformResponse: (response: ApiResponse<Channel>) => response.data,
      providesTags: (_result, _error, channelId) => [{ type: "Channels", id: channelId }],
    }),
  }),
})

export const {
  useCreateChannelMutation,
  useGetChannelByIdQuery,
} = channelApi
