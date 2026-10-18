import { baseApi } from "../api/baseApi"

type ApiResponse<T> = { data: T; message: string; statusCode: number; success?: boolean }
export type DirectMessage = { _id: string; conversation: string; sender: { _id: string; username: string; displayName?: string; avatar?: string }; content: string; clientId?: string | null; createdAt: string }
export type Conversation = { _id: string; participants: Array<{ _id: string; username: string; displayName?: string; avatar?: string; lastSeenAt?: string | null }>; lastMessageAt?: string | null }

export const directMessageApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getConversations: builder.query<Conversation[], void>({ query: () => "/direct-messages/conversations", transformResponse: (response: ApiResponse<Conversation[]>) => response.data }),
    createConversation: builder.mutation<Conversation, string>({ query: (participantId) => ({ url: "/direct-messages/conversations", method: "POST", body: { participantId } }), transformResponse: (response: ApiResponse<Conversation>) => response.data }),
    getDirectMessages: builder.query<DirectMessage[], { conversationId: string; before?: string }>({ query: ({ conversationId, before }) => ({ url: "/direct-messages/conversations/" + conversationId + "/messages", params: before ? { before } : undefined }), transformResponse: (response: ApiResponse<DirectMessage[]>) => response.data }),
    sendDirectMessage: builder.mutation<DirectMessage, { conversationId: string; content: string; clientId?: string }>({ query: ({ conversationId, ...body }) => ({ url: "/direct-messages/conversations/" + conversationId + "/messages", method: "POST", body }), transformResponse: (response: ApiResponse<DirectMessage>) => response.data }),
  }),
})

export const { useGetConversationsQuery, useCreateConversationMutation, useGetDirectMessagesQuery, useSendDirectMessageMutation } = directMessageApi
