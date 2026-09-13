// hooks/useChannelSync.ts
import { useEffect, useRef } from "react"
import { useDispatch } from "react-redux"
import { useLazyGetMessageHistoryQuery } from "../features/messages/message.api"
import { setMessagesForChannel } from "../features/messages/message.slice"
import type { RootState } from "../app/store"
import { useSelector } from "react-redux"
import { socketGateway } from "../gateway/socket"

export function useChannelSync(channelId: string | null) {
  const dispatch = useDispatch()
  const [fetchHistory] = useLazyGetMessageHistoryQuery()
  const lastSequence = useSelector((state: RootState) => {
    if (!channelId) return 0
    return Math.max(0, ...(state.message.messagesByChannel[channelId] || []).filter((message) => !message.isPending).map((message) => message.sequence))
  })
  const lastSequenceRef = useRef(lastSequence)
  useEffect(() => { lastSequenceRef.current = lastSequence }, [lastSequence])

  useEffect(() => {
    if (!channelId) return

    // 1. Join socket room immediately
    const join = () => socketGateway.joinChannel(channelId, lastSequenceRef.current)
    join()
    // Socket.IO reconnects automatically, but rooms are per connection. Rejoin and ask for the gap.
    socketGateway.onConnect(join)

    // 2. Fetch baseline REST history
    fetchHistory({ channelId, limit: 50 })
      .unwrap()
      .then((data) => {
        // Formatted messages from data (handles ApiResponse wrapper if present)
        const messages = Array.isArray(data) ? data : data?.messages || []
        
        // 3. Merges with any socket messages that arrived while request was in-flight
        dispatch(setMessagesForChannel({ channelId, messages }))
      })
      .catch((err) => {
        console.error("❌ Failed to fetch message history:", err)
      })

    return () => {
      socketGateway.leaveChannel(channelId)
      socketGateway.off("connect", join)
    }
  }, [channelId, fetchHistory, dispatch])
}
