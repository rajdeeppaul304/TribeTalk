import { useEffect } from "react"
import type { PropsWithChildren } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useAuthInit } from "../hooks/useAuthInit"
import type { RootState, AppDispatch } from "./store"
import { authApi } from "../features/auth/auth.api"
import { setAuth } from "../features/auth/authStore/auth.slice"

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const isLoading = useAuthInit()
  const dispatch = useDispatch<AppDispatch>()
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated)

  // Access tokens are short-lived. Refresh them in the background so an open
  // chat does not suddenly look logged out after the first expiry window.
  useEffect(() => {
    if (!isAuthenticated) return
    const refresh = async () => {
      try {
        const tokenData = await dispatch(authApi.endpoints.refreshToken.initiate()).unwrap()
        const user = await dispatch(authApi.endpoints.getCurrentUser.initiate()).unwrap()
        dispatch(setAuth({ user, token: tokenData.data.accessToken }))
      } catch (error) {
        console.warn("Background auth refresh failed", error)
      }
    }
    const timer = window.setInterval(refresh, 45 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [dispatch, isAuthenticated])

  if (isLoading) {
    // Render nothing or a spinner while auth is initializing
    return <div>Loading...</div>
  }

  return <>{children}</>
}
