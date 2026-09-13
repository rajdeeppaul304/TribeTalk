// features/auth/auth.api.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import type { ApiResponse, AuthResponse, User } from "./auth.types"
import { env } from "../../config/env"

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({
    baseUrl: env.apiUrl,
    credentials: "include", // matches your axios config
  }),
  endpoints: (builder) => ({
    register: builder.mutation<ApiResponse<User>, { username: string; email: string; password: string }>({
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
    refreshToken: builder.mutation<ApiResponse<{ accessToken: string }>, void>({
      query: () => ({
        url: "/users/refresh-token",
        method: "POST",
      }),
    }),
    getCurrentUser: builder.query<User, void>({
  query: () => "/users/current-user",
  transformResponse: (response: ApiResponse<User>) => response.data,
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
