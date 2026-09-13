// hooks/useMessages.ts (UPDATED)
import { useSelector, useDispatch } from "react-redux"
import { useCallback, useRef, useEffect } from "react"
import type { RootState, AppDispatch } from "../app/store"
import { socketGateway } from "../gateway/socket"
import { useLazyGetMessageHistoryQuery } from "../features/messages/message.api"
import { 
  addMessage, 
  prependMessages, 
  setEditingMessage,
  markMessagePending,
} from "../features/messages/message.slice"
import { useAuth } from "../features/auth/useAuth"
import type { Message, MessageAttachment } from "../features/types"

const EMPTY_MESSAGES: Message[] = []

/**
 * Complete hook for message operations
 */
export function useMessages(channelId: string | null) {
  const dispatch = useDispatch<AppDispatch>()
  const { user } = useAuth()
  const [fetchHistory] = useLazyGetMessageHistoryQuery()
  
  // Typing timeout ref
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)

  // Get messages from Redux
  const messages = useSelector((state: RootState) =>
    channelId ? state.message.messagesByChannel[channelId] : []
  ) ?? EMPTY_MESSAGES

  const editingMessageId = useSelector((state: RootState) => 
    state.message.editingMessageId
  )

  const typingUsers = useSelector((state: RootState) => {
    if (!channelId || !state.message.typingUsers[channelId]) return []
    return Object.values(state.message.typingUsers[channelId])
  }) 

  // ============================================
  // SEND MESSAGE
  // ============================================

  const sendMessage = useCallback((content: string, attachments: MessageAttachment[] = [], replyTo: string | null = null) => {
  const senderId = user?._id
  if (!channelId || !senderId) return


  const clientId = crypto.randomUUID()
  // const nowIso = new Date().toISOString()
  const now = new Date().toISOString()
  // Match the exact Message interface from types.ts
  const optimisticMessage: Message = {
  id: clientId,
  content,
  senderId: user._id,
  senderUsername: user.username,
  senderAvatar: user.avatar,
  channelId,
  sequence: Date.now(),
  timestamp: now,
  createdAt: now, // in case any formatter checks createdAt
  isEdited: false,
  isPending: true,
  clientId,
  attachments,
  replyTo,
}

  dispatch(addMessage({ channelId, message: optimisticMessage }))

  socketGateway.sendMessage({ channelId, content, clientId, attachments, replyTo })

  if (isTypingRef.current) {
    socketGateway.stopTyping(channelId)
    isTypingRef.current = false
  }
}, [channelId, user, dispatch])

  const retryMessage = useCallback((message: Message) => {
    if (!channelId || !message.clientId || !message.isFailed) return
    dispatch(markMessagePending({ channelId, clientId: message.clientId }))
    // Preserve the original clientId: the server returns the original row if a prior attempt succeeded.
    socketGateway.sendMessage({ channelId, content: message.content, clientId: message.clientId, attachments: message.attachments || [], replyTo: message.replyTo })
  }, [channelId, dispatch])




  // ============================================
  // EDIT MESSAGE
  // ============================================

  const startEdit = useCallback((messageId: string) => {
    dispatch(setEditingMessage(messageId))
  }, [dispatch])

  const cancelEdit = useCallback(() => {
    dispatch(setEditingMessage(null))
  }, [dispatch])

  const submitEdit = useCallback((messageId: string, newContent: string) => {
    if (!channelId) return

    // Send edit to server
    socketGateway.editMessage(messageId, newContent)
    
    // Cancel editing mode
    dispatch(setEditingMessage(null))
  }, [channelId, dispatch])

  // ============================================
  // DELETE MESSAGE
  // ============================================

  const deleteMessage = useCallback((messageId: string) => {
    if (!channelId) return
    socketGateway.deleteMessage(messageId)
  }, [channelId])
  const toggleReaction = useCallback((messageId: string, emoji: string) => socketGateway.toggleReaction(messageId, emoji), [])
  const togglePin = useCallback((messageId: string) => socketGateway.togglePin(messageId), [])

  // ============================================
  // TYPING INDICATOR
  // ============================================

  const handleTyping = useCallback(() => {
    if (!channelId) return

    // Start typing if not already
    if (!isTypingRef.current) {
      socketGateway.startTyping(channelId)
      isTypingRef.current = true
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socketGateway.stopTyping(channelId)
      isTypingRef.current = false
    }, 3000)
  }, [channelId])

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (channelId && isTypingRef.current) {
        socketGateway.stopTyping(channelId)
      }
    }
  }, [channelId])

  // ============================================
  // LOAD OLDER MESSAGES (Infinite Scroll)
  // ============================================

  const loadOlderMessages = useCallback(async () => {
    if (!channelId || messages.length === 0) return

    const oldestMessage = messages[0]
    console.log(`📜 Loading older messages before sequence ${oldestMessage.sequence}`)

    try {
      const { messages: olderMessages, hasMore } = await fetchHistory({
        channelId,
        limit: 50,
        before: oldestMessage.id,
      }).unwrap()

      if (olderMessages.length > 0) {
        dispatch(prependMessages({ channelId, messages: olderMessages }))
      }

      return { hasMore, count: olderMessages.length }
    } catch (error) {
      console.error("❌ Failed to load older messages:", error)
      return { hasMore: false, count: 0 }
    }
  }, [channelId, messages, fetchHistory, dispatch])

  // ============================================
  // RETURN
  // ============================================

  return {
    messages,
    sendMessage,
    retryMessage,
    
    // Edit
    editingMessageId,
    startEdit,
    cancelEdit,
    submitEdit,
    
    // Delete
    deleteMessage,
    toggleReaction,
    togglePin,
    
    // Typing
    handleTyping,
    typingUsers,
    
    // Pagination
    loadOlderMessages,
  }
}
