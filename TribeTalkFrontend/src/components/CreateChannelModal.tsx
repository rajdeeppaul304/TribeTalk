// CreateChannelModal.tsx (FIXED - Better error handling)
import { useState } from "react"
import { useCreateChannelMutation } from "../features/channels/channel.api"

interface Props {
  isOpen: boolean
  onClose: () => void
  serverId: string
  onChannelCreated?: () => void
}

type ApiError = {
  status?: number | string
  data?: { message?: string }
  message?: string
}

const isApiError = (error: unknown): error is ApiError =>
  typeof error === "object" && error !== null

const CreateChannelModal = ({ isOpen, onClose, serverId, onChannelCreated }: Props) => {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [createChannel, { isLoading }] = useCreateChannelMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("Channel name is required")
      return
    }

    setError(null)

    try {
      await createChannel({ 
        name: name.trim(), 
        serverId, 
        description: description.trim() 
      }).unwrap()
      
      // Success - reset form and close
      setName("")
      setDescription("")
      setError(null)
      onChannelCreated?.()
      onClose()
    } catch (err: unknown) {
      console.error("Failed to create channel", err)
      const apiError = isApiError(err) ? err : {}
      
      // Handle different error types
      if (apiError.status === 403) {
        setError("Permission denied: Only server owner or moderators can create channels")
      } else if (apiError.status === 401) {
        setError("You must be logged in to create channels")
      } else if (apiError.status === 'PARSING_ERROR') {
        // Backend returned HTML instead of JSON (likely an error page)
        setError("Server error: Unable to create channel. Check console for details.")
      } else if (apiError.data?.message) {
        setError(apiError.data.message)
      } else if (apiError.message) {
        setError(apiError.message)
      } else {
        setError("Failed to create channel. Please try again.")
      }
    }
  }

  const handleClose = () => {
    setName("")
    setDescription("")
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-gray-800 p-6 rounded shadow-md w-96">
        <h2 className="text-lg font-bold mb-4 text-white">Create Channel</h2>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Channel name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null) // Clear error on input
            }}
            className="w-full p-2 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            disabled={isLoading}
          />
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 text-white disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateChannelModal
