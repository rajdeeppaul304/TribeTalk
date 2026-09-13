// LeftSidebar.tsx
import { useState } from "react"
import { useServer } from "../hooks/useServer"
import { useChannel } from "../hooks/useChannel"
import CreateServerModal from "./CreateServerModal"
import CreateChannelModal from "./CreateChannelModal"
import { useSelector } from "react-redux";
import type { RootState } from "../app/store"; // adjust path to your store
import { socketGateway } from "../gateway/socket"
import {copyToClipboard} from "../utils/commonTools"



const LeftSidebar = () => {
  const { servers, activeServerId, selectServer, isLoading: serversLoading } = useServer()
  const { channels, selectChannel, isLoading: channelsLoading, refetchChannels } = useChannel(activeServerId)
  const [isServerModalOpen, setIsServerModalOpen] = useState(false)
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false)
  const unreadCounts = useSelector((state: RootState) => state.channel.unreadCounts)
  const baseUrl=`${window.location.origin}/server/join-server/`
  const activeServer = servers.find((server) => server._id === activeServerId)
  const inviteUrl = activeServer?.inviteCode
    ? `${baseUrl}${activeServer._id}?invite=${encodeURIComponent(activeServer.inviteCode)}`
    : null
  // const activeChannelId = useSelector(
  //     (state: RootState) => state.channel.activeChannelId
  //   )


  console.log("inreadcounsssssssss",unreadCounts)
  console.log(activeServerId)



  



  return (
    <div className="w-64 h-screen bg-gray-800 text-white p-4">
      <div className="flex gap-2 justify-evenly">
        <h1 className="text-xl font-bold mb-6">My App</h1>
      <button onClick={() => inviteUrl && copyToClipboard(inviteUrl)}
      disabled={!inviteUrl}
      className="
        flex items-center gap-2 
        bg-blue-600 hover:bg-blue-700
        text-white font-medium
        px-4 py-1
        rounded-lg
        shadow-md hover:shadow-lg
        transition-all duration-200
        active:scale-95
        focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50
      "
    >
      📋 Copy
    </button>
      </div>
      

      {/* 🔹 Servers */}
      <div className="mb-6">
        {serversLoading && <p className="text-sm text-gray-400">Loading servers...</p>}

        {servers.map((server) => (
          <button
            key={server._id}
            onClick={() => {selectServer(server._id);socketGateway.getUnreadCounts()}
              
            }
            
            className={`block w-full text-left p-2 rounded ${activeServerId === server._id ? "bg-gray-700" : ""
              }`}
          >
            {server.name}
          </button>
        ))}

        <button
          onClick={() => setIsServerModalOpen(true)}
          className="mt-2 w-full p-2 bg-green-600 rounded hover:bg-green-500"
        >
          + Create Server
        </button>
      </div>

      {/* 🔹 Channels */}
      <div>
        {channelsLoading ? (
          <p className="text-sm text-gray-400">Loading channels...</p>
        ) : (
          channels.map((channel) => (
            <button
              key={channel._id}
              onClick={() => selectChannel(channel._id)}
              className="flex justify-between w-full text-left p-2 hover:bg-gray-700"
            >
              <span>#{channel.name}</span>
              {unreadCounts[channel._id] > 0 &&  (
                <span className="ml-2 text-xs bg-red-600 px-2 rounded-full">
                  {unreadCounts[channel._id]}
                </span>
              )}
            </button>
          ))
        )}

        {/* Create Channel Button */}
        {activeServerId && (
          <button
            onClick={() => setIsChannelModalOpen(true)}
            className="mt-2 w-full p-2 bg-blue-600 rounded hover:bg-blue-500"
          >
            + Create Channel
          </button>
        )}
      </div>

      <CreateServerModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
      />
      <CreateChannelModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        serverId={activeServerId!} // guaranteed to exist
        onChannelCreated={() => refetchChannels?.()} // refresh channels after creation
      />
    </div>
  )
}

export default LeftSidebar
