import { baseApi } from "../api/baseApi"
import type { MessageAttachment } from "../types"

type ApiResponse<T> = {
  statusCode: number
  data: T
  message: string
  success: boolean
}

export const uploadApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    uploadImage: builder.mutation<MessageAttachment, File>({
      query: (image) => {
        const body = new FormData()
        body.append("image", image)
        return { url: "/uploads/image", method: "POST", body }
      },
      transformResponse: (response: ApiResponse<MessageAttachment>) => response.data,
    }),
  }),
})

export const { useUploadImageMutation } = uploadApi
