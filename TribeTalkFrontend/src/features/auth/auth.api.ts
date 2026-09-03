// features/auth/auth.api.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import type AuthResponse from "./auth.types"

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "http://localhost:3000/api/v1",
    credentials: "include", // matches your axios config
  }),
  endpoints: (builder) => ({
    register: builder.mutation<AuthResponse, { username: string; email: string; password: string }>({
      query: (data) => ({
        url: "/users/register",
        method: "POST",
        body: data,
      }),
    }),
    login: builder.mutation<AuthResponse, { email: string; password: string }>({
      query: (data) => ({
        url: "/users/login",
        method: "POST",
        body: data,
      }),
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/users/logout",
        method: "POST",
      }),
    }),
    refreshToken: builder.mutation<{ data: { accessToken: string }; message: string }, void>({
      query: () => ({
        url: "/users/refresh-token",
        method: "POST",
      }),
    }),
    getCurrentUser: builder.query<AuthResponse["user"], void>({
  query: () => "/users/current-user",
  transformResponse: (response: { data: AuthResponse["user"] }) => response.data,
}),
  }),
})

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
  useGetCurrentUserQuery,
} = authApi
