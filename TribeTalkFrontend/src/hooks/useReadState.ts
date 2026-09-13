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
        const lastMessageId = messageId || messages[messages.length - 1]?.id

        if (lastMessageId && lastMessageId !== lastReadMessageIdRef.current) {
          console.log(`✅ Marking channel ${channelId} as read up to ${lastMessageId}`)

          // Rely exclusively on WebSocket; backend persists via Message.service
          socketGateway.markAsRead(channelId, lastMessageId)
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
   * Mark as read when channel first opens
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

    const lastMessageId = messages[messages.length - 1]?.id
    if (!lastMessageId) return

    if (markAsReadTimeoutRef.current) {
      clearTimeout(markAsReadTimeoutRef.current)
      markAsReadTimeoutRef.current = null
    }

    socketGateway.markAsRead(channelId, lastMessageId)
    lastReadMessageIdRef.current = lastMessageId
  }, [channelId, messages])

  return {
    markAsRead: manualMarkAsRead,
  }
}
