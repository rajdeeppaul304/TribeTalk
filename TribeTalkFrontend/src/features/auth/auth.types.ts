// features/auth/auth.types.ts
export interface User {
  _id: string
  username: string
  email: string
  avatar?: string
  displayName?: string
  bio?: string
  createdAt?: string
  updatedAt?: string
  lastSeenAt?: string | null
  notificationPreferences?: { browser?: boolean; mentions?: boolean; unread?: boolean }
}

export interface PublicProfile {
  _id: string
  username: string
  displayName: string
  avatar?: string
  bio?: string
  createdAt?: string
  lastSeenAt?: string | null
  online?: boolean
}

export interface AppNotification {
  _id: string
  type: "mention" | "unread"
  channel: string
  message: string
  readAt?: string | null
  createdAt: string
  actor?: { username?: string }
}


export interface ApiResponse<T> {
  statusCode: number
  data: T
  message: string
  success: boolean
}

export interface AuthPayload {
  user: User
  accessToken: string
  refreshToken?: string
}

export type AuthResponse = ApiResponse<AuthPayload>
