import { baseApi } from "../api/baseApi"

type ApiResponse<T> = { data: T; message: string; statusCode: number; success?: boolean }
export type ScheduledMessage = { _id: string; channel: string; content: string; scheduledFor: string; status: "scheduled" | "sent" | "cancelled" | "failed" }
export const scheduledMessageApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    scheduleMessage: builder.mutation<ScheduledMessage, { channelId: string; content: string; scheduledFor: string }>({ query: (body) => ({ url: "/scheduled-messages", method: "POST", body }), transformResponse: (response: ApiResponse<ScheduledMessage>) => response.data }),
    getScheduledMessages: builder.query<ScheduledMessage[], string>({ query: (channelId) => "/scheduled-messages/" + channelId, transformResponse: (response: ApiResponse<ScheduledMessage[]>) => response.data }),
    cancelScheduledMessage: builder.mutation<ScheduledMessage, string>({ query: (id) => ({ url: "/scheduled-messages/" + id, method: "DELETE" }), transformResponse: (response: ApiResponse<ScheduledMessage>) => response.data }),
  }),
})
export const { useScheduleMessageMutation, useGetScheduledMessagesQuery, useCancelScheduledMessageMutation } = scheduledMessageApi
