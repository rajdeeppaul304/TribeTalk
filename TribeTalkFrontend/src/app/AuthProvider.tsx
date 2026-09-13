import type { PropsWithChildren } from "react"
import { useAuthInit } from "../hooks/useAuthInit"

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const isLoading = useAuthInit()

  if (isLoading) {
    // Render nothing or a spinner while auth is initializing
    return <div>Loading...</div>
  }

  return <>{children}</>
}
