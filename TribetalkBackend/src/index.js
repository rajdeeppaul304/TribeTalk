import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { env } from "./config/env.js";

import { app } from "./app.js";  
import connectDB from "./Repository/index.js";
import setupGateway from "./socket/gateway.js";

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: env.CORS_ORIGIN,
    credentials: true,
  },
});

setupGateway(io);

const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ MongoDB connected");

    server.listen(env.PORT, () => {
      console.log(`🚀 Server running at http://localhost:${env.PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
