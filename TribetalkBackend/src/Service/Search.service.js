import { ApiError } from "../Utils/ApiError.js";
import { findUserAccessibleChannelIds } from "../Repository/Server.repository.js";
import { getElasticsearchClient, isElasticsearchReady, MESSAGE_INDEX } from "../config/elasticsearch.js";
import { Message } from "../Models/Message.model.js";

const toSearchDocument = (message) => ({
  messageId: message._id.toString(),
  channelId: message.channel.toString(),
  senderId: message.sender?._id?.toString() || message.sender.toString(),
  senderUsername: message.sender?.username || "",
  content: message.content,
  createdAt: message.createdAt,
});

export const indexMessage = async (message) => {
  if (!isElasticsearchReady()) return;
  try {
    await getElasticsearchClient().index({ index: MESSAGE_INDEX, id: message._id.toString(), document: toSearchDocument(message), refresh: false });
  } catch (error) {
    console.error("Elasticsearch message index failed:", error.message);
  }
};

export const removeMessageFromIndex = async (messageId) => {
  if (!isElasticsearchReady()) return;
  try {
    await getElasticsearchClient().delete({ index: MESSAGE_INDEX, id: messageId.toString(), refresh: false });
  } catch (error) {
    if (error.meta?.statusCode !== 404) console.error("Elasticsearch message delete failed:", error.message);
  }
};

export const searchMessages = async (userId, query, limit) => {
  if (!isElasticsearchReady()) throw new ApiError(503, "Message search is unavailable right now");
  const channelIds = await findUserAccessibleChannelIds(userId);
  if (channelIds.length === 0) return [];

  const result = await getElasticsearchClient().search({
    index: MESSAGE_INDEX,
    size: limit,
    query: {
      bool: {
        filter: [{ terms: { channelId: channelIds } }],
        must: [{ simple_query_string: { query, fields: ["content^3", "senderUsername"], default_operator: "and" } }],
      },
    },
    highlight: { fields: { content: {} }, pre_tags: ["<mark>"], post_tags: ["</mark>"] },
    sort: [{ _score: "desc" }, { createdAt: "desc" }],
  });

  return result.hits.hits.map((hit) => ({
    ...hit._source,
    highlight: hit.highlight?.content?.[0] || hit._source.content,
  }));
};

export const backfillMessageSearchIndex = async () => {
  if (!isElasticsearchReady()) return;
  const messages = await Message.find({ deletedAt: null })
    .select("_id channel sender content createdAt")
    .populate("sender", "username")
    .lean();
  if (messages.length === 0) return;

  const operations = messages.flatMap((message) => [
    { index: { _index: MESSAGE_INDEX, _id: message._id.toString() } },
    toSearchDocument(message),
  ]);
  const response = await getElasticsearchClient().bulk({ operations, refresh: true });
  if (response.errors) console.error("Elasticsearch initial message backfill completed with errors");
  else console.log(`✅ Elasticsearch indexed ${messages.length} existing messages`);
};
