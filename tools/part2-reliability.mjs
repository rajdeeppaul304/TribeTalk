import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../TribeTalkFrontend/package.json", import.meta.url));
const { io } = require("socket.io-client");

const config = Object.fromEntries(
  fs.readFileSync(new URL("./.env.loadtest.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)]; })
);

const baseUrl = process.env.BASE_URL || config.BASE_URL || "http://localhost:8080";
const token = process.env.ACCESS_TOKEN || config.ACCESS_TOKEN;
const channelId = process.env.CHANNEL_ID || config.CHANNEL_ID;
const loadTestKey = process.env.LOAD_TEST_KEY || config.LOAD_TEST_KEY || "local-only-load-test";
const total = Number(process.env.RELIABILITY_MESSAGES || 1000);
const reconnectEvery = Number(process.env.RECONNECT_EVERY || 100);
const expected = new Map();
const received = new Map();
const failures = [];
let socket;
let latestSequence = 0;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const connect = () => new Promise((resolve, reject) => {
  socket = io(baseUrl, { auth: { token, loadTestKey }, transports: ["websocket"], reconnection: false });
  const timeout = setTimeout(() => reject(new Error("socket connection timeout")), 10000);
  socket.once("connect", () => { clearTimeout(timeout); resolve(); });
  socket.once("connect_error", (error) => { clearTimeout(timeout); reject(error); });
  socket.on("new_message", (message) => {
    if (!message?.clientId) return;
    received.set(message.clientId, (received.get(message.clientId) || 0) + 1);
    latestSequence = Math.max(latestSequence, Number(message.sequence || 0));
  });
});

const join = () => new Promise((resolve) => {
  socket.emit("join_channel", { channelId, lastKnownSequence: latestSequence });
  setTimeout(resolve, 150);
});

const send = (clientId) => new Promise((resolve) => {
  const started = performance.now();
  socket.timeout(10000).emit("send_message", { channelId, content: `reliability-${clientId}`, clientId }, (error, response) => {
    if (error || !response?.ok) failures.push({ clientId, error: error?.message || response?.error || "ack failed" });
    else expected.set(clientId, { messageId: response.message.id, latencyMs: performance.now() - started });
    resolve();
  });
});

await connect();
await join();
for (let index = 1; index <= total; index += 1) {
  const clientId = `reliability-${Date.now()}-${index}`;
  await send(clientId);
  if (index % reconnectEvery === 0) {
    socket.disconnect();
    await wait(250);
    await connect();
    await join();
  }
}
await wait(1000);
socket.disconnect();

const delivered = [...expected.keys()].filter((id) => received.has(id)).length;
const duplicates = [...received.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
const latencies = [...expected.values()].map((item) => item.latencyMs).sort((a, b) => a - b);
const percentile = (p) => latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * p) - 1)] : null;
console.log(JSON.stringify({ total, acknowledged: expected.size, delivered, deliveryRate: expected.size ? delivered / expected.size : 0, duplicates, failedAcks: failures.length, ackP95Ms: percentile(0.95), latestSequence }, null, 2));
if (failures.length || duplicates > 0 || delivered / Math.max(1, expected.size) < 0.999) process.exitCode = 1;
