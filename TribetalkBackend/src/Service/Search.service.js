import { ApiError } from "../Utils/ApiError.js"
import { findUserAccessibleChannelIds } from "../Repository/Server.repository.js"
import { getElasticsearchClient, isElasticsearchReady, MESSAGE_INDEX } from "../config/elasticsearch.js"
import { Message } from "../Models/Message.model.js"
import { dispatchOutboxEvent } from "./Outbox.service.js"
import { cacheKeys, getCached, setCached } from "./Cache.service.js"
import { trackDependency } from "../config/metrics.js"

const toSearchDocument = (message) => ({
  messageId: message._id.toString(),
  channelId: message.channel.toString(),
  senderId: message.sender?._id?.toString() || message.sender.toString(),
  senderUsername: message.sender?.username || "",
  content: message.content,
  createdAt: message.createdAt,
  hasAttachments: Boolean(message.attachments?.length),
})

export const indexMessageNow = async (message, { requireReady = false } = {}) => {
  if (!isElasticsearchReady()) {
    if (requireReady) throw new Error("Elasticsearch is unavailable")
    return
  }
  const id = message._id?.toString() || message.messageId
  const document = message.messageId ? message : toSearchDocument(message)
  await trackDependency("elasticsearch", "index", () => getElasticsearchClient().index({ index: MESSAGE_INDEX, id, document, refresh: false }))
}

export const indexMessage = async (message) => {
  const payload = toSearchDocument(message)
  return dispatchOutboxEvent({
    type: "search.index_message",
    payload,
    fallback: () => indexMessageNow(payload),
  })
}

export const removeMessageFromIndexNow = async (messageId, { requireReady = false } = {}) => {
  if (!isElasticsearchReady()) {
    if (requireReady) throw new Error("Elasticsearch is unavailable")
    return
  }
  try {
    await trackDependency("elasticsearch", "delete", () => getElasticsearchClient().delete({ index: MESSAGE_INDEX, id: messageId.toString(), refresh: false }))
  } catch (error) {
    if (error.meta?.statusCode !== 404) throw error
  }
}

export const removeMessageFromIndex = async (messageId) => dispatchOutboxEvent({
  type: "search.remove_message",
  payload: { messageId: messageId.toString() },
  fallback: () => removeMessageFromIndexNow(messageId),
})

export const searchMessages = async (userId, query, limit, filters = {}) => {
  if (!isElasticsearchReady()) throw new ApiError(503, "Message search is unavailable right now")
  const cacheKey = cacheKeys.search(userId, JSON.stringify({ query, limit, filters }))
  const cached = await getCached(cacheKey)
  if (cached) return cached
  const channelIds = await findUserAccessibleChannelIds(userId)
  if (channelIds.length === 0) return []

  const filter = [{ terms: { channelId: channelIds } }]
  if (filters.channelId) filter.push({ term: { channelId: filters.channelId } })
  if (filters.senderId) filter.push({ term: { senderId: filters.senderId } })
  if (filters.hasAttachments !== undefined) filter.push({ term: { hasAttachments: filters.hasAttachments } })
  if (filters.from || filters.to) filter.push({ range: { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } })
  const result = await trackDependency("elasticsearch", "search", () => getElasticsearchClient().search({
    index: MESSAGE_INDEX,
    size: limit,
    query: {
      bool: {
        filter,
        must: [{ simple_query_string: { query, fields: ["content^3", "senderUsername"], default_operator: "and" } }],
      },
    },
    highlight: { fields: { content: {} }, pre_tags: ["<mark>"], post_tags: ["</mark>"] },
    sort: [{ _score: "desc" }, { createdAt: "desc" }],
  }))

  const matches = result.hits.hits.map((hit) => ({
    ...hit._source,
    highlight: hit.highlight?.content?.[0] || hit._source.content,
  }))
  await setCached(cacheKey, matches, 20)
  return matches
}

export const backfillMessageSearchIndex = async () => {
  if (!isElasticsearchReady()) return
  const messages = await Message.find({ deletedAt: null })
    .select("_id channel sender content createdAt")
    .populate("sender", "username")
    .lean()
  if (messages.length === 0) return

  const operations = messages.flatMap((message) => [
    { index: { _index: MESSAGE_INDEX, _id: message._id.toString() } },
    toSearchDocument(message),
  ])
  const response = await trackDependency("elasticsearch", "bulk", () => getElasticsearchClient().bulk({ operations, refresh: true }))
  if (response.errors) console.error("Elasticsearch initial message backfill completed with errors")
  else console.log(`✅ Elasticsearch indexed ${messages.length} existing messages`)
}

