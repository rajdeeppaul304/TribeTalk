import { Client } from "@elastic/elasticsearch";
import { env } from "./env.js";

export const MESSAGE_INDEX = "tribetalk-messages";
let elasticsearchClient = null;
let elasticsearchReady = false;
let messageIndexCreated = false;

if (env.ELASTICSEARCH_URL) {
  // Keep the JavaScript client on Elasticsearch 8.x to match the Docker service.
  // Search is an asynchronous side effect of sending a message. Keep failed
  // Elasticsearch calls bounded so an outage cannot consume the message path.
  elasticsearchClient = new Client({
    node: env.ELASTICSEARCH_URL,
    requestTimeout: 250,
    maxRetries: 0,
  });
}

export const initializeElasticsearch = async () => {
  if (!elasticsearchClient) return null;
  try {
    await elasticsearchClient.ping();
    const exists = await elasticsearchClient.indices.exists({ index: MESSAGE_INDEX });
    if (!exists) {
      try {
        await elasticsearchClient.indices.create({
          index: MESSAGE_INDEX,
          mappings: {
            properties: {
              messageId: { type: "keyword" },
              channelId: { type: "keyword" },
              senderId: { type: "keyword" },
              senderUsername: { type: "keyword" },
              content: { type: "text", analyzer: "standard" },
              createdAt: { type: "date" },
            },
          },
        });
        messageIndexCreated = true;
      } catch (createError) {
        // Both backend replicas may observe a missing index at the same time.
        // If the other replica creates it first, that is a successful startup,
        // not an Elasticsearch outage.
        const errorType = createError.meta?.body?.error?.type;
        const statusCode = createError.meta?.statusCode;
        if (statusCode !== 400 || errorType !== "resource_already_exists_exception") throw createError;
      }
    }
    elasticsearchReady = true;
    console.log("✅ Elasticsearch connected");
    return elasticsearchClient;
  } catch (error) {
    console.error("⚠️ Elasticsearch unavailable; message search is disabled:", error.message);
    elasticsearchReady = false;
    return null;
  }
};

export const getElasticsearchClient = () => elasticsearchClient;
export const isElasticsearchReady = () => elasticsearchReady;
export const wasMessageIndexCreated = () => messageIndexCreated;

export const shutdownElasticsearch = async () => {
  elasticsearchReady = false;
  if (elasticsearchClient) await elasticsearchClient.close().catch(() => undefined);
};
