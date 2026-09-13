// features/channels/channel.slice.ts (FIXED)
import { createSlice } from "@reduxjs/toolkit"
import type { PayloadAction } from "@reduxjs/toolkit"
import type { Channel, ChannelState } from '../types'



// uncomment this code to use actual data instead of filler
// const initialState: ChannelState = {
//   channelsByServer: {},
//   activeChannelId: null
// }

const initialState: ChannelState = {
  channelsByServer: {},
  activeChannelId: null,
  unreadCounts:{}
  
}

const channelSlice = createSlice({
  name: "channel",
  initialState,
  reducers: {
    setChannelsForServer(
      state,
      action: PayloadAction<{ serverId: string; channels: Channel[] }>  // FIXED: number → string
    ) {
      state.channelsByServer[action.payload.serverId] = action.payload.channels
    },
    
    setActiveChannel(state, action: PayloadAction<string>) {  // FIXED: number → string
      state.activeChannelId = action.payload
      if(state.unreadCounts[state.activeChannelId]!==undefined){
        state.unreadCounts[state.activeChannelId]=0
        

      }
      

    },
    setUnreadCount(state, action: PayloadAction<{ [channelId: string] : number }>) { 
      
      // FIXED: number → string
      
    state.unreadCounts={
      ...state.unreadCounts,
      ...action.payload
    }
    },
    incrementUnreadCountForChannel(state, action: PayloadAction<{channelId: string} >) {  // FIXED: number → string
    const {channelId} =action.payload
    console.log("called from slice .ts",channelId,state.activeChannelId)
    if(channelId!=state.activeChannelId){
      state.unreadCounts[channelId]=(state.unreadCounts[channelId]??0)+1
    }
    },
    
    
    // NEW: Add a single channel to a server (for optimistic updates)
    addChannelToServer(
      state,
      action: PayloadAction<{ serverId: string; channel: Channel }>
    ) {
      const { serverId, channel } = action.payload
      if (!state.channelsByServer[serverId]) {
        state.channelsByServer[serverId] = []
      }
      state.channelsByServer[serverId].push(channel)
    }
  }
})

export const { setChannelsForServer, setActiveChannel, addChannelToServer,setUnreadCount,incrementUnreadCountForChannel } =
  channelSlice.actions
export default channelSlice.reducer
