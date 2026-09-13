// hooks/useChannel.ts (FIXED)
import { useDispatch } from "react-redux"
import { setActiveChannel, setUnreadCount, incrementUnreadCountForChannel } from "../features/channels/channel.slice"
import { useGetServerByIdQuery, serverApi } from "../features/servers/server.api"
import { socketGateway } from "../gateway/socket"
import React, { useEffect } from "react"
import type { Channel } from "../features/types"
import type { AppDispatch } from "../app/store"



export function useChannel(serverId: string | null) {
  const dispatch = useDispatch<AppDispatch>()

  const { data: server, isLoading, refetch } = useGetServerByIdQuery(serverId ?? "", {
    skip: !serverId
  })

  // NEW: force a fresh fetch whenever the active server changes,
// in case channel_created events were missed while viewing a different server
useEffect(() => {
  if (serverId) {
    refetch()
  }
}, [serverId, refetch])

  const channels = React.useMemo(() => server?.channels ?? [], [server?.channels])

  const selectChannel = (channelId: string) => {
    dispatch(setActiveChannel(channelId))
    socketGateway.joinChannel(channelId)  // FIXED: now receives string
  }

  // FIXED: Added refetchChannels function
  const refetchChannels = React.useCallback(() => {
    if (serverId) {
      refetch()
    }
  }, [serverId, refetch])
  useEffect(() => {
    if (!serverId) return;

    const handleUnreadCounts = (data: { [channelId: string]: number }) => {
      dispatch(setUnreadCount(data))
    }
    const incrementUnreadCount = (data: { channelId: string }) => {


      dispatch(incrementUnreadCountForChannel(data))


    }

    const handleChannelCreated = (data: { channel: Channel; serverId: string }) => {
  if (data.serverId === serverId) {
    dispatch(
      serverApi.util.updateQueryData("getServerById", data.serverId, (draft) => {
        draft.channels.push(data.channel)
      })
    )
  }
}

    const handleReconnect = () => {
      refetchChannels()
    }

    socketGateway.onConnect(handleReconnect)

    socketGateway.onChannelCreated(handleChannelCreated)

    socketGateway.onChannelActivity(incrementUnreadCount)

    socketGateway.onUnreadCounts(handleUnreadCounts)

    // ask backend for counts WHEN server changes
    socketGateway.getUnreadCounts()

    return () => {
      socketGateway.offUnreadCounts(handleUnreadCounts)
      socketGateway.offChannelCreated(handleChannelCreated)
      socketGateway.offChannelActivity(incrementUnreadCount)
      socketGateway.off("connect", handleReconnect)


    }
  }, [dispatch, serverId, refetchChannels])


  return {
    channels,
    selectChannel,
    isLoading,
    refetchChannels  // FIXED: Now exposed
  }
}
