// features/servers/server.api.ts
import { baseApi } from "../api/baseApi"
import type { ServerSummary, ServerFull } from "../types"

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
  }),
})

export const {
  useGetServersQuery,
  useGetServerByIdQuery,
  useCreateServerMutation,
  useEditServerMutation,
  useJoinServerMutation,
} = serverApi
