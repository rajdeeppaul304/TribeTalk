import  { createSlice } from "@reduxjs/toolkit"
import type { User } from "../auth.types"
import type { PayloadAction } from "@reduxjs/toolkit"


type AuthState = {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth(
      state,
      action: PayloadAction<{ user: User; token: string }>
    ) {
      console.log( "action.payload",action.payload,action.payload.token)
      state.user = action.payload.user
      state.token = action.payload.token
      state.isAuthenticated = true
    },
    clearAuth(state) {
      state.user = null
      state.token = null
      state.isAuthenticated = false
    },
  },
})

export const { setAuth, clearAuth } = authSlice.actions
export default authSlice.reducer
