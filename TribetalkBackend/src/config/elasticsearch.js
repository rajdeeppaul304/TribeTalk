import { Client } from "@elastic/elasticsearch";
import { env } from "./env.js";

export const MESSAGE_INDEX = "tribetalk-messages";
let elasticsearchClient = null;
let elasticsearchReady = false;
let messageIndexCreated = false;

if (env.ELASTICSEARCH_URL) {
  elasticsearchClient = new Client({ node: env.ELASTICSEARCH_URL });
}

export const initializeElasticsearch = async () => {
  if (!elasticsearchClient) return null;
  try {
    await elasticsearchClient.ping();
    const exists = await elasticsearchClient.indices.exists({ index: MESSAGE_INDEX });
    if (!exists) {
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
