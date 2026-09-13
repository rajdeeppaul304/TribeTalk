// components/RightContent.tsx (COMPLETE)
import { useState, useEffect, useRef } from "react"
import { useSelector } from "react-redux"
import type { RootState } from "../app/store"
import { useMessages } from "../hooks/useMessages"
import { useChannelSync } from "../hooks/useChannelSync"
import { useReadState } from "../hooks/useReadState"
import { useIntersectionObserver } from "../hooks/useIntersectionObserver"
import { useAuth } from "../features/auth/useAuth"
import type { Message } from "../features/types"

const RightContent = () => {
  const [messageInput, setMessageInput] = useState("")
  const [editContent, setEditContent] = useState("")
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const { user } = useAuth()
  const activeChannelId = useSelector(
    (state: RootState) => state.channel.activeChannelId
  )

  // Join/leave channel and fetch initial messages
  useChannelSync(activeChannelId)

  // Get message operations
  const {
    messages,
    sendMessage,
    editingMessageId,
    startEdit,
    cancelEdit,
    submitEdit,
    deleteMessage,
    handleTyping,
    typingUsers,
    loadOlderMessages,
  } = useMessages(activeChannelId)

  // Track if messages container is visible in viewport
  const { elementRef: visibilityRef, isVisible } = useIntersectionObserver({
    threshold: 0.1,
  })

  // Mark messages as read automatically
  const { markAsRead } = useReadState({
    channelId: activeChannelId,
    messages,
    isVisible,
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current
      const isScrolledToBottom =
        container.scrollHeight - container.scrollTop <= container.clientHeight + 100

      if (isScrolledToBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }
    }
  }, [messages])

  // Handle scroll for infinite scroll
  const handleScroll = async () => {
    const container = messagesContainerRef.current
    if (!container || isLoadingOlder) return

    if (container.scrollTop === 0 && messages.length > 0) {
      setIsLoadingOlder(true)

      const oldScrollHeight = container.scrollHeight

      const result = await loadOlderMessages()

      setIsLoadingOlder(false)

      if (result && result.count > 0) {
        setTimeout(() => {
          const newScrollHeight = container.scrollHeight
          container.scrollTop = newScrollHeight - oldScrollHeight
        }, 0)
      }
    }
  }

  // Handle send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim()) return

    sendMessage(messageInput.trim())
    setMessageInput("")

    // Mark channel as read after sending (you've seen everything up to your message)
    markAsRead()
  }

  // Handle edit message
  const handleStartEdit = (message: Message) => {
    startEdit(message.id)
    setEditContent(message.content)
  }

  const handleSubmitEdit = (messageId: string) => {
    if (!editContent.trim()) return
    submitEdit(messageId, editContent.trim())
    setEditContent("")
  }

  const handleCancelEdit = () => {
    cancelEdit()
    setEditContent("")
  }

  // Handle input change (trigger typing indicator)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value)
    handleTyping()
  }

  // No channel selected
  if (!activeChannelId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900 text-gray-400">
        <p>Select a channel to start messaging</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* Messages List */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {/* Loading older messages indicator */}
        {isLoadingOlder && (
          <div className="text-center text-gray-500 py-2">
            Loading older messages...
          </div>
        )}

        {/* Visibility tracker (for read state) */}
        <div ref={visibilityRef} className="h-0" />

        {/* Messages */}
        {messages.length === 0 ? (
          <p className="text-gray-500 text-center mt-10">
            No messages yet. Be the first to send one!
          </p>
        ) : (
          messages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              isOwn={msg.senderId === user?._id}
              currentUsername={user?.username}
              isEditing={editingMessageId === msg.id}
              editContent={editContent}
              onEditContentChange={setEditContent}
              onStartEdit={() => handleStartEdit(msg)}
              onSubmitEdit={() => handleSubmitEdit(msg.id)}
              onCancelEdit={handleCancelEdit}
              onDelete={() => deleteMessage(msg.id)}
            />
          ))
        )}

        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <div className="text-gray-400 text-sm italic">
            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={messageInput}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 bg-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!!editingMessageId}
          />
          <button
            type="submit"
            disabled={!!editingMessageId}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

// ============================================
// MESSAGE ITEM COMPONENT
// ============================================

interface MessageItemProps {
  message: Message
  isOwn: boolean
  currentUsername?: string
  isEditing: boolean
  editContent: string
  onEditContentChange: (content: string) => void
  onStartEdit: () => void
  onSubmitEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
}

const MessageItem = ({
  message,
  isOwn,
  currentUsername,
  isEditing,
  editContent,
  onEditContentChange,
  onStartEdit,
  onSubmitEdit,
  onCancelEdit,
  onDelete,
}: MessageItemProps) => {
  const [showActions, setShowActions] = useState(false)
  const [hasWaitedToSend, setHasWaitedToSend] = useState(false)

  // Only show "Sending..." if the message is still pending after 400ms.
  // The message itself still renders instantly (optimistic UI) — this
  // just delays the label so fast round-trips don't flash it.
  useEffect(() => {
    if (!message.isPending) return
    const timer = setTimeout(() => setHasWaitedToSend(true), 400)
    return () => clearTimeout(timer)
  }, [message.isPending])

  const showSending = Boolean(message.isPending && hasWaitedToSend)

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return ""
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return ""
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  if (isEditing) {
    return (
      <div className="bg-gray-800 p-3 rounded border-2 border-blue-500">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-blue-400 font-semibold">
            {message.senderUsername || `User ${message.senderId}`}
          </span>
          <span className="text-xs text-gray-500">(editing)</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={editContent}
            onChange={(e) => onEditContentChange(e.target.value)}
            className="flex-1 bg-gray-700 text-white px-3 py-1 rounded"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmitEdit()
              if (e.key === "Escape") onCancelEdit()
            }}
          />
          <button
            onClick={onSubmitEdit}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-500"
          >
            Save
          </button>
          <button
            onClick={onCancelEdit}
            className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`bg-gray-800 p-3 rounded relative ${
        message.isFailed ? "border-2 border-red-500" : ""
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-baseline gap-2">
        <span className={`font-semibold ${isOwn ? "text-green-400" : "text-blue-400"}`}>
          {message.senderUsername ||
            (isOwn ? currentUsername : `User ${message.senderId?.slice(-4)}`)}
        </span>
        <span className="text-xs text-gray-500">
          {formatTime(message.timestamp || message.createdAt)}
        </span>
        {showSending && (
          <span className="text-xs text-yellow-500">Sending...</span>
        )}
      </div>

      <p className={`text-gray-200 mt-1 ${message.deletedAt ? "italic text-gray-500" : ""}`}>
        {message.content}
      </p>

      {showActions && isOwn && !message.deletedAt && !message.isPending && (
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={onStartEdit}
            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-500"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

export default RightContent
