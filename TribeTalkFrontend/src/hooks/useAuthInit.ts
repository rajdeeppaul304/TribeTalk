import { useEffect, useState } from "react"
import { useDispatch } from "react-redux"
import { authApi } from "../features/auth/auth.api"
import { setAuth, clearAuth } from "../features/auth/authStore/auth.slice"
// import type { AppDispatch } from "../features/auth/authStore/auth.store"
import type { AppDispatch } from "../app/store"

export const useAuthInit = () => {
  const dispatch = useDispatch<AppDispatch>()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      try {
        const tokenData = await dispatch(authApi.endpoints.refreshToken.initiate()).unwrap()
        const user = await dispatch(authApi.endpoints.getCurrentUser.initiate()).unwrap()
        if (isMounted) {
          dispatch(setAuth({ user, token: tokenData.data.accessToken }))
        }
      } catch (err) {
        console.error("Auth initialization failed", err)
        if (isMounted) dispatch(clearAuth())
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    init()

    return () => {
      isMounted = false
    }
  }, [dispatch])

  return isLoading
}
