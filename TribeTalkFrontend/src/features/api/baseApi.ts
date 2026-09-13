// features/api/baseApi.ts (UPDATED)
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query"
import { env } from "../../config/env"

const baseQueryWithErrorHandling: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const baseQuery = fetchBaseQuery({
    baseUrl: env.apiUrl,
    credentials: "include"
  })

  return await baseQuery(args, api, extraOptions)
}

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithErrorHandling,
  tagTypes: ["Servers", "Channels", "Messages"], // UPDATED: Added Messages
  endpoints: () => ({})
})
