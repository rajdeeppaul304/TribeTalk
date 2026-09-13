// features/servers/server.api.ts
import { baseApi } from "../api/baseApi"
import type { ServerSummary, ServerFull, Invite } from "../types"

type ApiResponse<T> = {
  statusCode: number
  data: T
  message: string
  success?: boolean
}

export const serverApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Existing endpoints
    getServers: builder.query<ServerSummary[], void>({
      query: () => "/server/list-all-server",
      transformResponse: (response: ApiResponse<ServerSummary[]>) => response.data,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: "Servers" as const, id: _id })),
              { type: "Servers" as const, id: "LIST" }
            ]
          : [{ type: "Servers" as const, id: "LIST" }]
    }),

    getServerById: builder.query<ServerFull, string>({
      query: (serverId) => `/server/single-server/${serverId}`,
      transformResponse: (response: ApiResponse<ServerFull>) => response.data,
      providesTags: (_result, _error, serverId) => [{ type: "Servers", id: serverId }]
    }),

    // New endpoints
    createServer: builder.mutation<ServerFull, { name: string; description: string }>({
      query: (body) => ({
        url: "/server/create-server",
        method: "POST",
        body,
      }),
      transformResponse: (response: ApiResponse<ServerFull>) => response.data,
      invalidatesTags: [{ type: "Servers", id: "LIST" }], // refresh server list after creating
    }),

    editServer: builder.mutation<
      ServerFull,
      { serverId: string; name: string; description: string }
    >({
      query: ({ serverId, ...body }) => ({
        url: `/server/edit-server/${serverId}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response: ApiResponse<ServerFull>) => response.data,
      invalidatesTags: (_result, _error, { serverId }) => [{ type: "Servers", id: serverId }],
    }),

    joinServer: builder.mutation<
      { _id: string; name: string },
      { serverId: string; inviteCode: string }
    >({
      query: ({ serverId, inviteCode }: { serverId: string; inviteCode: string }) => ({
        url: `/server/join-server/${serverId}`,
        method: "POST",
        body: { inviteCode },
      }),
      transformResponse: (response: ApiResponse<{ _id: string; name: string }>) =>
        response.data,
      invalidatesTags: [{ type: "Servers", id: "LIST" }],
    }),
    getInvites: builder.query<Invite[], string>({
      query: (serverId) => `/server/${serverId}/invites`,
      transformResponse: (response: ApiResponse<Invite[]>) => response.data,
      providesTags: (_result, _error, id) => [{ type: "Servers", id: `INVITES-${id}` }],
    }),
    createInvite: builder.mutation<Invite, { serverId: string; expiresInHours?: number; maxUses?: number }>({
      query: ({ serverId, ...body }) => ({ url: `/server/${serverId}/invites`, method: "POST", body }),
      transformResponse: (response: ApiResponse<Invite>) => response.data,
      invalidatesTags: (_result, _error, { serverId }) => [{ type: "Servers", id: `INVITES-${serverId}` }],
    }),
    revokeInvite: builder.mutation<void, { serverId: string; inviteId: string }>({
      query: ({ serverId, inviteId }) => ({ url: `/server/${serverId}/invites/${inviteId}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { serverId }) => [{ type: "Servers", id: `INVITES-${serverId}` }],
    }),
    setMemberRole: builder.mutation<void, { serverId: string; memberId: string; role: "member" | "moderator" }>({
      query: ({ serverId, memberId, role }) => ({ url: `/server/${serverId}/members/${memberId}/role`, method: "PATCH", body: { role } }),
      invalidatesTags: (_result, _error, { serverId }) => [{ type: "Servers", id: serverId }],
    }),
    removeMember: builder.mutation<void, { serverId: string; memberId: string }>({
      query: ({ serverId, memberId }) => ({ url: `/server/${serverId}/members/${memberId}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { serverId }) => [{ type: "Servers", id: serverId }, { type: "Servers", id: "LIST" }],
    }),
  }),
})

export const {
  useGetServersQuery,
  useGetServerByIdQuery,
  useCreateServerMutation,
  useEditServerMutation,
  useJoinServerMutation,
  useGetInvitesQuery,
  useCreateInviteMutation,
  useRevokeInviteMutation,
  useSetMemberRoleMutation,
  useRemoveMemberMutation,
} = serverApi
