// features/auth/auth.types.ts
export interface User {
  _id: string
  username: string
  email: string
  avatar?: string
  createdAt?: string
  updatedAt?: string
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
