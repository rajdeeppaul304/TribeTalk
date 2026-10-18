// hooks/useReadState.ts
import { useEffect, useRef, useCallback } from "react"
import { socketGateway } from "../gateway/socket"
import type { Message } from "../features/types"

interface UseReadStateProps {
  channelId: string | null
  messages: Message[]
  isVisible: boolean // Is the message container visible/in view
}

/**
 * Hook to automatically mark messages as read
 * Tracks visibility and marks channel as read when appropriate
 */
export function useReadState({ channelId, messages, isVisible }: UseReadStateProps) {
  const lastReadMessageIdRef = useRef<string | null>(null)
  const markAsReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastReadSentAtRef = useRef(0)
  const persistedMessageId = () => [...messages].reverse().find((message) => /^[a-f\d]{24}$/i.test(message.id))?.id

  /**
   * Reset tracking ref and pending timer when switching channels
   */
  useEffect(() => {
    if (markAsReadTimeoutRef.current) {
      clearTimeout(markAsReadTimeoutRef.current)
      markAsReadTimeoutRef.current = null
    }
    lastReadMessageIdRef.current = null
  }, [channelId])

  /**
   * Mark the channel as read (debounced)
   */
  const markAsRead = useCallback(
    (messageId?: string) => {
      if (!channelId) return

      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current)
      }

      // Debounce by 1 second to bundle rapid bursts of incoming messages
      markAsReadTimeoutRef.current = setTimeout(() => {
        const lastMessageId = messageId && /^[a-f\d]{24}$/i.test(messageId) ? messageId : persistedMessageId()

        if (lastMessageId && lastMessageId !== lastReadMessageIdRef.current) {
          console.log(`✅ Marking channel ${channelId} as read up to ${lastMessageId}`)

          // Rely exclusively on WebSocket; backend persists via Message.service
          if (Date.now() - lastReadSentAtRef.current < 750) return
          socketGateway.markAsRead(channelId, lastMessageId)
          lastReadSentAtRef.current = Date.now()
          lastReadMessageIdRef.current = lastMessageId
        }
      }, 1000)
    },
    [channelId, messages]
  )

  /**
   * Mark as read when new messages arrive and user is viewing the channel
   */
  useEffect(() => {
    if (channelId && messages.length > 0 && isVisible) {
      markAsRead()
    }
  }, [channelId, messages.length, isVisible, markAsRead])

  /**
   * Mark as read when window gains focus
   */
  useEffect(() => {
    if (!channelId) return

    const handleFocus = () => {
      if (messages.length > 0 && isVisible) {
        markAsRead()
      }
    }

    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [channelId, messages.length, isVisible, markAsRead])

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current)
      }
    }
  }, [])

  /**
   * Manually mark as read immediately (bypasses debounce for user actions like sending a message)
   */
  const manualMarkAsRead = useCallback(() => {
    if (!channelId || messages.length === 0) return

    const lastMessageId = persistedMessageId()
    if (!lastMessageId) return

    if (markAsReadTimeoutRef.current) {
      clearTimeout(markAsReadTimeoutRef.current)
      markAsReadTimeoutRef.current = null
    }

    if (Date.now() - lastReadSentAtRef.current < 750) return
    socketGateway.markAsRead(channelId, lastMessageId)
    lastReadSentAtRef.current = Date.now()
    lastReadMessageIdRef.current = lastMessageId
  }, [channelId, messages])

  return {
    markAsRead: manualMarkAsRead,
  }
}
