// features/types.ts (UPDATED)

export interface Channel {
  _id: string
  name: string
  type: "text" | "voice"
  description?: string
  server: string | ServerSummary
  createdBy: string
  createdAt: string
  updatedAt: string
  __v?: number
}

export interface ChannelState {
  channelsByServer: Record<string, Channel[]>
  activeChannelId: string | null
  unreadCounts:Record<string, number>
}

export type ServerRole = "owner" | "moderator" | "member"
export interface ServerMember { _id: string; username: string }

export interface ServerSummary {
  _id: string
  name: string
  description?: string
  owner?: string | ServerMember
  inviteCode?: string
  role?: ServerRole
}

export interface ServerFull extends ServerSummary {
  role: ServerRole
  owner: ServerMember
  moderators: ServerMember[]
  members: ServerMember[]
  channels: Channel[]
}

export interface Invite { _id: string; code: string; expiresAt: string | null; maxUses: number | null; uses: number; revokedAt: string | null; createdAt: string }

// UPDATED: Complete message type with all backend fields
export interface Message {
  id: string                    // MongoDB _id
  content: string
  senderId: string
  senderUsername?: string       // From populated sender
  senderAvatar?: string         // From populated sender
  channelId: string
  sequence: number              // For ordering
  timestamp: string             // ISO string
  createdAt?: string            // 👈 Add this line (ISO string from Mongo)
  isEdited: boolean
  editedAt?: string             // ISO string
  isSystemMessage?: boolean
  clientId?: string             // For optimistic updates
  deletedAt?: string            // For soft deletes
  isPending?: boolean           // Local-only flag for optimistic updates
  isFailed?: boolean            // Local-only flag for failed sends
  attachments?: MessageAttachment[]
  replyTo?: string | null
  threadRoot?: string | null
  reactions?: { emoji: string; userIds: string[] }[]
  pinnedAt?: string | null
}

export interface MessageAttachment {
  url: string
  publicId: string
  format: string
  bytes: number
  width: number
  height: number
}

export interface MessageSearchResult {
  messageId: string
  channelId: string
  senderId: string
  senderUsername: string
  content: string
  highlight: string
  createdAt: string
}
export interface MessageState {
  messagesByChannel: Record<string, Message[]>
  editingMessageId: string | null
  // channelId -> { [userId]: username }
  typingUsers: Record<string, Record<string, string>>
}

// NEW: Typing indicator data
export interface TypingIndicator {
  channelId: string
  userId: string
  username: string
}

// NEW: Sync state from backend
export interface SyncState {
  channelId: string
  latestMessageId: string | null
  latestSequence: number
  unreadCount: number
  lastReadSequence: number
}
