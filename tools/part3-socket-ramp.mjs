import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../TribeTalkFrontend/package.json", import.meta.url));
const { io } = require("socket.io-client");
const config = Object.fromEntries(fs.readFileSync(new URL("./.env.loadtest.local", import.meta.url), "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
const baseUrl = process.env.BASE_URL || config.BASE_URL || "http://localhost:8080";
const token = process.env.ACCESS_TOKEN || config.ACCESS_TOKEN;
const channelId = process.env.CHANNEL_ID || config.CHANNEL_ID;
const loadTestKey = process.env.LOAD_TEST_KEY || config.LOAD_TEST_KEY || "local-only-load-test";
const target = Number(process.env.SOCKET_TARGET || 100);
const rampPerSecond = Number(process.env.SOCKET_RAMP_PER_SEC || 10);
const holdSeconds = Number(process.env.SOCKET_HOLD_SECONDS || 60);
const sockets = new Set(); let connected = 0; let errors = 0; const errorReasons = new Map();
const connectOne = () => new Promise((resolve) => {
  const socket = io(baseUrl, { auth: { token, loadTestKey }, transports: ["websocket"], reconnection: false });
  let settled = false; const finish = () => { if (!settled) { settled = true; resolve(); } };
  socket.once("connect", () => { connected += 1; sockets.add(socket); socket.emit("join_channel", { channelId, lastKnownSequence: 0 }); finish(); });
  socket.once("connect_error", (error) => { errors += 1; const reason = error?.message || "unknown"; errorReasons.set(reason, (errorReasons.get(reason) || 0) + 1); socket.close(); finish(); }); setTimeout(() => { if (!settled) { errors += 1; errorReasons.set("connect timeout", (errorReasons.get("connect timeout") || 0) + 1); } finish(); }, 10000);
});
for (let offset = 0; offset < target; offset += rampPerSecond) { await Promise.all(Array.from({ length: Math.min(rampPerSecond, target - offset) }, connectOne)); console.log(`Ramp progress: attempted=${Math.min(offset + rampPerSecond, target)} connected=${connected} errors=${errors}`); await new Promise((resolve) => setTimeout(resolve, 1000)); }
console.log(`Holding ${connected} sockets for ${holdSeconds}s...`); await new Promise((resolve) => setTimeout(resolve, holdSeconds * 1000)); for (const socket of sockets) socket.close();
console.log(JSON.stringify({ target, connected, errors, errorReasons: Object.fromEntries(errorReasons), connectionSuccessRate: connected / Math.max(1, target), holdSeconds }, null, 2));
