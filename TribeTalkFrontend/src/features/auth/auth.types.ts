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
}

export interface PublicProfile {
  _id: string
  username: string
  displayName: string
  avatar?: string
  bio?: string
  createdAt?: string
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
