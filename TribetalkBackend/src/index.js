import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { env } from "./config/env.js";

import connectDB from "./Repository/index.js";
import setupGateway from "./socket/gateway.js";
import { initializeRedis, shutdownRedis } from "./config/redis.js";
import { initializeElasticsearch, shutdownElasticsearch, wasMessageIndexCreated } from "./config/elasticsearch.js";
import { backfillMessageSearchIndex } from "./Service/Search.service.js";

let server;

const initializeSearchWithRetry = async () => {
  const client = await initializeElasticsearch();
  if (client) {
    if (wasMessageIndexCreated()) await backfillMessageSearchIndex();
    return;
  }

  // Elasticsearch can take longer than its container health check to become
  // query-ready on the first boot. Keep the app available and recover search
  // automatically instead of requiring a backend restart.
  setTimeout(() => {
    void initializeSearchWithRetry();
  }, 10_000);
};

const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ MongoDB connected");
    const redisClients = await initializeRedis();
    // `app.js` creates Redis-backed rate limiters during module loading.
    // Import it only after Redis is connected so the store is ready.
    const { app } = await import("./app.js");
    server = createServer(app);
    const io = new Server(server, {
      cors: {
        origin: env.CORS_ORIGIN,
        credentials: true,
      },
    });
    void initializeSearchWithRetry();
    setupGateway(io, redisClients);

    server.listen(env.PORT, () => {
      console.log(`🚀 Server running at http://localhost:${env.PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

const shutdown = async () => {
  await shutdownRedis();
  await shutdownElasticsearch();
  if (server) server.close(() => process.exit(0));
  else process.exit(0);
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
