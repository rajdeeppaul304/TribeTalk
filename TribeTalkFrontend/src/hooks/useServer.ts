//useServer.ts
import { useDispatch, useSelector } from "react-redux"
import { setActiveServer } from "../features/servers/server.slice"
import { useGetServersQuery } from "../features/servers/server.api"
import type { RootState } from "../app/store"

export function useServer() {
  const dispatch = useDispatch()
  const activeServerId = useSelector((s: RootState) => s.server.activeServerId)

  // Fetch servers list once
  const { data: servers = [], isLoading } = useGetServersQuery(undefined, {
    // keep cached data to prevent flashing
    refetchOnMountOrArgChange: false,
  })

  // Optimistic selection: only update activeServerId in Redux
  const selectServer = (id: string) => {
    dispatch(setActiveServer(id))
  }

  return {
    servers,
    activeServerId,
    selectServer,
    isLoading,
  }
}
