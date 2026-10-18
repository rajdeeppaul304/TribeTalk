import { useEffect, useRef, useState } from "react"
import { useDispatch } from "react-redux"
import { authApi } from "../features/auth/auth.api"
import { setAuth, clearAuth } from "../features/auth/authStore/auth.slice"
// import type { AppDispatch } from "../features/auth/authStore/auth.store"
import type { AppDispatch } from "../app/store"

let authInitPromise: Promise<{ user: any; token: string }> | null = null

export const useAuthInit = () => {
  const dispatch = useDispatch<AppDispatch>()
  const [isLoading, setIsLoading] = useState(true)
  const startedRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    if (startedRef.current) return undefined
    startedRef.current = true

    if (!authInitPromise) {
      authInitPromise = (async () => {
        const tokenData = await dispatch(authApi.endpoints.refreshToken.initiate()).unwrap()
        const user = await dispatch(authApi.endpoints.getCurrentUser.initiate()).unwrap()
        return { user, token: tokenData.data.accessToken }
      })()
    }
    authInitPromise.then(({ user, token }) => {
      if (isMounted) dispatch(setAuth({ user, token }))
    }).catch((err) => {
      console.error("Auth initialization failed", err)
      if (isMounted) dispatch(clearAuth())
    }).finally(() => {
      if (isMounted) setIsLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [dispatch])

  return isLoading
}
