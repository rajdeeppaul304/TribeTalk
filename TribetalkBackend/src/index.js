import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { env } from "./config/env.js";

import { app } from "./app.js";  
import connectDB from "./Repository/index.js";
import setupGateway from "./socket/gateway.js";
import { initializeRedis, shutdownRedis } from "./config/redis.js";
import { initializeElasticsearch, shutdownElasticsearch, wasMessageIndexCreated } from "./config/elasticsearch.js";
import { backfillMessageSearchIndex } from "./Service/Search.service.js";

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: env.CORS_ORIGIN,
    credentials: true,
  },
});

const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ MongoDB connected");
    const redisClients = await initializeRedis();
    await initializeElasticsearch();
    if (wasMessageIndexCreated()) await backfillMessageSearchIndex();
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
  server.close(() => process.exit(0));
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
