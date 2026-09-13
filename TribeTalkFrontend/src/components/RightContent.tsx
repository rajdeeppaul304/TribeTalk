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
import { useNavigate } from "react-router-dom"
import { useUploadImageMutation } from "../features/uploads/upload.api"
import type { MessageAttachment } from "../features/types"
import { ImagePlus, Pin, Send, X } from "lucide-react"
import { useGetServerByIdQuery } from "../features/servers/server.api"

const RightContent = () => {
  const [messageInput, setMessageInput] = useState("")
  const [editContent, setEditContent] = useState("")
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [attachmentError, setAttachmentError] = useState("")
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [showPinned, setShowPinned] = useState(false)
  const [uploadImage, { isLoading: isUploading }] = useUploadImageMutation()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const { user } = useAuth()
  const activeChannelId = useSelector(
    (state: RootState) => state.channel.activeChannelId
  )
  const activeServerId = useSelector((state: RootState) => state.server.activeServerId)
  const { data: activeServer } = useGetServerByIdQuery(activeServerId ?? "", { skip: !activeServerId })
  const mentionMatch = messageInput.match(/@([\w-]*)$/)
  const mentionCandidates = mentionMatch && activeServer ? [activeServer.owner, ...activeServer.moderators, ...activeServer.members].filter((member): member is { _id: string; username: string } => typeof member !== "string" && member.username.toLowerCase().includes(mentionMatch[1].toLowerCase())).slice(0, 5) : []

  // Join/leave channel and fetch initial messages
  useChannelSync(activeChannelId)

  // Get message operations
  const {
    messages,
    sendMessage,
    retryMessage,
    toggleReaction,
    togglePin,
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
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() && !selectedImage) return

    let attachments: MessageAttachment[] = []
    if (selectedImage) {
      try {
        attachments = [await uploadImage(selectedImage).unwrap()]
      } catch {
        setAttachmentError("Image upload failed. Check Cloudinary configuration and try again.")
        return
      }
    }

    sendMessage(messageInput.trim(), attachments, replyTo?.id || null)
    setMessageInput("")
    setSelectedImage(null)
    setAttachmentError("")
    setReplyTo(null)

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

  const selectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0] || null
    setSelectedImage(image)
    setAttachmentError("")
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
    <div className="flex h-full min-h-0 flex-1 flex-col bg-ink">
      {messages.some((message) => message.pinnedAt) && <div className="flex items-center gap-2 border-b soft-border bg-panel px-5 py-2 text-sm"><Pin size={15} className="text-accent"/><button onClick={() => setShowPinned(!showPinned)} className="text-[#c0c8c7]">{messages.filter((message) => message.pinnedAt).length} pinned message{messages.filter((message) => message.pinnedAt).length === 1 ? "" : "s"}</button>{showPinned && <span className="ml-2 truncate text-[#899493]">{messages.find((message) => message.pinnedAt)?.content}</span>}</div>}
      {/* Messages List */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto px-5 py-4"
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
          <p className="mt-10 text-center text-[#899493]">
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
              onRetry={() => retryMessage(msg)}
              onReply={() => setReplyTo(msg)}
              onReact={(emoji) => toggleReaction(msg.id, emoji)}
              onPin={() => togglePin(msg.id)}
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
      <form onSubmit={handleSendMessage} className="shrink-0 border-t soft-border bg-panel p-4">
        {replyTo && <div className="mb-2 flex items-center justify-between rounded-lg bg-ink px-3 py-2 text-sm text-[#c0c8c7]">Replying to {replyTo.senderUsername || "message"}<button type="button" onClick={() => setReplyTo(null)} className="icon-button"><X size={15}/></button></div>}
        {selectedImage && <div className="mb-2 flex items-center gap-2 text-sm text-accent"><span>Attached: {selectedImage.name}</span><button type="button" onClick={() => setSelectedImage(null)} className="text-red-300 hover:text-red-200">Remove</button></div>}
        {attachmentError && <p className="mb-2 text-sm text-red-300">{attachmentError}</p>}
        <div className="flex gap-2 rounded-xl border soft-border bg-ink p-1.5">
          <input
            type="text"
            value={messageInput}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-paper outline-none"
            disabled={!!editingMessageId || isUploading}
          />
          <label className="icon-button cursor-pointer" title="Attach image">
            <ImagePlus size={18}/>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={selectImage} disabled={!!editingMessageId || isUploading} className="hidden" />
          </label>
          <button
            type="submit"
            disabled={!!editingMessageId || isUploading}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? "…" : <Send size={17}/>}<span className="sr-only">Send</span>
          </button>
        </div>
        {mentionCandidates.length > 0 && <div className="absolute bottom-20 left-5 z-20 w-64 overflow-hidden rounded-xl border soft-border bg-panel p-1 shadow-2xl">{mentionCandidates.map((member) => <button type="button" key={member._id} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/7" onClick={() => setMessageInput(messageInput.replace(/@[\w-]*$/, `@${member.username} `))}><span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent">{member.username.slice(0,1).toUpperCase()}</span>@{member.username}</button>)}</div>}
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
  onRetry: () => void
  onReply: () => void
  onReact: (emoji: string) => void
  onPin: () => void
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
  onRetry,
  onReply,
  onReact,
  onPin,
}: MessageItemProps) => {
  const navigate = useNavigate()
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
      className={`group relative rounded-lg px-3 py-2 ${
        message.isFailed ? "border border-red-400/60 bg-red-400/5" : "hover:bg-white/[.035]"
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-baseline gap-2">
        <button onClick={() => navigate(`/profile/${message.senderId}`)} className="font-semibold text-accent hover:text-accent-soft hover:underline">
          {message.senderUsername ||
            (isOwn ? currentUsername : `User ${message.senderId?.slice(-4)}`)}
        </button>
        <span className="text-xs text-[#899493]">
          {formatTime(message.timestamp || message.createdAt)}
        </span>
        {showSending && (
          <span className="text-xs text-yellow-500">Sending...</span>
        )}
        {message.isFailed && <button onClick={onRetry} className="text-xs text-red-300 hover:text-red-200">Failed — retry</button>}
      </div>

      {message.content && <p className={`mt-1 text-sm leading-6 text-[#d9e1df] ${message.deletedAt ? "italic text-[#899493]" : ""}`}>{message.content}</p>}
      {message.replyTo && <p className="mt-1 text-xs text-accent">↳ Reply in thread</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        {(message.reactions || []).map((reaction) => <button key={reaction.emoji} onClick={() => onReact(reaction.emoji)} className="rounded-md border soft-border bg-panel px-2 py-1 text-xs hover:border-accent/50">{reaction.emoji} {reaction.userIds.length}</button>)}
      </div>
      {message.attachments?.map((attachment) => (
        <a key={attachment.publicId} href={attachment.url} target="_blank" rel="noreferrer" className="mt-2 block w-fit">
          <img src={attachment.url} alt="Message attachment" className="max-h-80 max-w-full rounded object-contain" loading="lazy" />
        </a>
      ))}

      {showActions && !message.deletedAt && !message.isPending && (
        <div className="absolute -top-4 right-3 flex gap-1 rounded-lg border soft-border bg-panel p-1 shadow-xl">
          <button onClick={() => onReact("👍")} className="icon-button" title="React">👍</button><button onClick={() => onReact("❤️")} className="icon-button" title="React">❤️</button><button onClick={() => onReact("😂")} className="icon-button" title="React">😂</button><button onClick={onReply} className="icon-button" title="Reply">↩</button><button onClick={onPin} className="icon-button" title="Pin">⌖</button>
          {isOwn && <>
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
          </>}
        </div>
      )}
    </div>
  )
}

export default RightContent
