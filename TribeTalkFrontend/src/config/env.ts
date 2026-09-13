const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")

export const env = {
  apiUrl: trimTrailingSlash(import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1"),
  socketUrl: trimTrailingSlash(import.meta.env.VITE_SOCKET_URL || "http://localhost:3000"),
}
