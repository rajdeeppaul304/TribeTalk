// features/auth/auth.api.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import type { ApiResponse, AppNotification, AuthResponse, PublicProfile, User } from "./auth.types"
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
    requestEmailVerification: builder.mutation<ApiResponse<null>, { email: string }>({ query: (body) => ({ url: "/users/email-verification/request", method: "POST", body }) }),
    verifyEmail: builder.mutation<ApiResponse<null>, { email: string; otp: string }>({ query: (body) => ({ url: "/users/email-verification/verify", method: "POST", body }) }),
    requestPasswordReset: builder.mutation<ApiResponse<null>, { email: string }>({ query: (body) => ({ url: "/users/password-reset/request", method: "POST", body }) }),
    resetPassword: builder.mutation<ApiResponse<null>, { email: string; otp: string; password: string }>({ query: (body) => ({ url: "/users/password-reset/confirm", method: "POST", body }) }),
    getCurrentUser: builder.query<User, void>({
  query: () => "/users/current-user",
  transformResponse: (response: ApiResponse<User>) => response.data,
}),
    updateProfile: builder.mutation<User, { displayName?: string; avatar?: string; bio?: string; notificationPreferences?: { browser?: boolean; mentions?: boolean; unread?: boolean } }>({
      query: (body) => ({ url: "/users/profile", method: "PATCH", body }),
      transformResponse: (response: ApiResponse<User>) => response.data,
    }),
    getPublicUserProfile: builder.query<PublicProfile, string>({
      query: (userId) => `/users/${userId}/profile`,
      transformResponse: (response: ApiResponse<PublicProfile>) => response.data,
    }),
    getNotifications: builder.query<AppNotification[], void>({
      query: () => "/users/notifications",
      transformResponse: (response: ApiResponse<AppNotification[]>) => response.data,
    }),
    markNotificationsRead: builder.mutation<void, string[] | void>({
      query: (ids) => ({ url: "/users/notifications", method: "PATCH", body: { ids: ids || [] } }),
    }),
  }),
})

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
  useRequestEmailVerificationMutation,
  useVerifyEmailMutation,
  useRequestPasswordResetMutation,
  useResetPasswordMutation,
  useGetCurrentUserQuery,
  useUpdateProfileMutation,
  useGetPublicUserProfileQuery,
  useGetNotificationsQuery,
  useMarkNotificationsReadMutation,
} = authApi
