import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const require = createRequire(new URL("../TribeTalkFrontend/package.json", import.meta.url));
const { io } = require("socket.io-client");
const envText = await fs.readFile(new URL("./.env.loadtest.local", import.meta.url), "utf8").catch(() => "");
const config = Object.fromEntries(envText.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));

const baseUrl = process.env.BASE_URL || config.BASE_URL || "http://localhost:8080";
const token = process.env.ACCESS_TOKEN || config.ACCESS_TOKEN;
const channelId = process.env.CHANNEL_ID || config.CHANNEL_ID;
const loadTestKey = process.env.LOAD_TEST_KEY || config.LOAD_TEST_KEY || "local-only-load-test";
const total = Number(process.env.RELIABILITY_MESSAGES || 1000);
const intervalMs = Number(process.env.MESSAGE_INTERVAL_MS || 100);
const faultAfterMs = Number(process.env.FAULT_AFTER_MS || 5000);
const faultDurationMs = Number(process.env.FAULT_DURATION_MS || 5000);
const faultService = process.env.FAULT_SERVICE || "backend-1";
const forceDisconnectOnFault = process.env.FORCE_DISCONNECT_ON_FAULT === "true";
const compose = ["-f", "docker-compose.yml", "-f", "docker-compose.local-scale.yml"];
const ledgerFile = process.env.LEDGER_FILE || "tools/.generated/failover-ledger.json";
const ledger = { faultService, total, messages: [], received: {}, reconnects: 0, failures: [] };
let socket;
let latestSequence = 0;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const connect = () => new Promise((resolve, reject) => {
  socket = io(baseUrl, { auth: { token, loadTestKey }, transports: ["websocket"], reconnection: false, forceNew: true, timeout: 10000 });
  const timeout = setTimeout(() => reject(new Error("socket connection timeout")), 10000);
  socket.once("connect", () => { clearTimeout(timeout); resolve(); });
  socket.once("connect_error", (error) => { clearTimeout(timeout); reject(error); });
  socket.on("new_message", (message) => {
    if (!message?.clientId) return;
    ledger.received[message.clientId] = (ledger.received[message.clientId] || 0) + 1;
    latestSequence = Math.max(latestSequence, Number(message.sequence || 0));
  });
});
const join = async () => { socket.emit("join_channel", { channelId, lastKnownSequence: latestSequence }); await wait(200); };
const reconnect = async () => {
  if (socket?.connected) return;
  ledger.reconnects += 1;
  await connect();
  await join();
};
const sendOnce = (clientId) => new Promise((resolve) => {
  const started = performance.now();
  socket.timeout(3000).emit("send_message", { channelId, content: `failover-${clientId}`, clientId }, (error, response) => resolve({ error, response, latencyMs: performance.now() - started }));
});
const sendWithRetry = async (clientId) => {
  await reconnect();
  let result = await sendOnce(clientId);
  if (result.error || !result.response?.ok) {
    socket?.disconnect();
    await wait(250);
    await reconnect();
    result = await sendOnce(clientId);
  }
  const item = { clientId, attempts: result.error || !result.response?.ok ? 2 : 1, latencyMs: result.latencyMs };
  if (result.error || !result.response?.ok) {
    item.error = result.error?.message || result.response?.error || "ack failed";
    ledger.failures.push(item);
  } else item.messageId = result.response.message?.id;
  ledger.messages.push(item);
  await fs.writeFile(ledgerFile, JSON.stringify(ledger, null, 2));
};

if (!token || !channelId) throw new Error("Set ACCESS_TOKEN and CHANNEL_ID (or tools/.env.loadtest.local) first");
await fs.mkdir(new URL("./.generated/", import.meta.url), { recursive: true });
await connect();
await join();
let faultFinished = false;
const fault = (async () => {
  await wait(faultAfterMs);
  await exec("docker", ["compose", ...compose, "stop", faultService], { windowsHide: true });
  console.log(`Fault injected: stopped ${faultService}`);
  if (forceDisconnectOnFault) {
    socket?.disconnect();
    console.log("Forced client disconnect to exercise reconnect recovery");
  }
  await wait(faultDurationMs);
  await exec("docker", ["compose", ...compose, "start", faultService], { windowsHide: true });
  faultFinished = true;
  console.log(`Fault recovered: started ${faultService}`);
})();
try {
  for (let index = 1; index <= total; index += 1) { await sendWithRetry(`failover-${Date.now()}-${index}`); await wait(intervalMs); }
  await fault.catch((error) => ledger.failures.push({ error: `fault injection failed: ${error.message}` }));
  await wait(1000);
} finally {
  if (!faultFinished) await fault.catch(() => undefined);
  socket?.disconnect();
}

const expected = new Set(ledger.messages.map(({ clientId }) => clientId));
const delivered = [...expected].filter((id) => ledger.received[id]).length;
const duplicates = Object.values(ledger.received).reduce((sum, count) => sum + Math.max(0, count - 1), 0);
const latencies = ledger.messages.filter((item) => !item.error).map(({ latencyMs }) => latencyMs).sort((a, b) => a - b);
const percentile = (p) => latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * p) - 1)] : null;
const report = { generatedAt: new Date().toISOString(), faultService, forceDisconnectOnFault, total, acknowledged: ledger.messages.filter((item) => !item.error).length, delivered, deliveryRate: delivered / Math.max(1, total), duplicates, reconnects: ledger.reconnects, failedMessages: ledger.failures.length, ackP95Ms: percentile(0.95), ledgerFile };
await fs.writeFile(ledgerFile, JSON.stringify({ ...ledger, report }, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.deliveryRate < 0.999 || report.duplicates > 0 || report.failedMessages > 0) process.exitCode = 1;
