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
const faultService = process.env.FAULT_SERVICE || "elasticsearch";
const total = Number(process.env.OUTAGE_MESSAGES || 200);
const intervalMs = Number(process.env.MESSAGE_INTERVAL_MS || 100);
const faultAfterMs = Number(process.env.FAULT_AFTER_MS || 3000);
const faultDurationMs = Number(process.env.FAULT_DURATION_MS || 5000);
const ackTimeoutMs = Number(process.env.ACK_TIMEOUT_MS || 3000);
const compose = ["-f", "docker-compose.yml", "-f", "docker-compose.local-scale.yml"];
const ledger = { faultService, total, sent: [], acknowledgements: [], received: {}, failures: [] };
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
const stop = async () => { await exec("docker", ["compose", ...compose, "stop", faultService], { windowsHide: true }); console.log(`Fault injected: stopped ${faultService}`); };
const restore = async () => { await exec("docker", ["compose", ...compose, "start", faultService], { windowsHide: true }); console.log(`Fault recovered: started ${faultService}`); };
const send = (clientId) => new Promise((resolve) => {
  const started = performance.now();
  socket.timeout(ackTimeoutMs).emit("send_message", { channelId, content: `outage-benchmark-${clientId}`, clientId }, (error, response) => {
    const latencyMs = performance.now() - started;
    ledger.sent.push(clientId);
    if (error || !response?.ok) ledger.failures.push({ clientId, error: error?.message || response?.error || "ack failed", latencyMs });
    else ledger.acknowledgements.push({ clientId, latencyMs });
    resolve();
  });
});

if (!token || !channelId) throw new Error("Set ACCESS_TOKEN and CHANNEL_ID (or tools/.env.loadtest.local) first");
await connect();
await join();
let faultError;
const fault = setTimeout(async () => { try { await stop(); await wait(faultDurationMs); await restore(); } catch (error) { faultError = error; } }, faultAfterMs);
try {
  for (let index = 1; index <= total; index += 1) { await send(`${faultService}-${Date.now()}-${index}`); await wait(intervalMs); }
  await wait(1000);
} finally {
  clearTimeout(fault);
  if (faultError) ledger.failures.push({ error: `fault injection failed: ${faultError.message}` });
  socket?.disconnect();
}
const latencies = ledger.acknowledgements.map(({ latencyMs }) => latencyMs).sort((a, b) => a - b);
const percentile = (p) => latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * p) - 1)] : null;
ledger.acknowledged = ledger.acknowledgements.length;
ledger.deliveryObserved = Object.keys(ledger.received).length;
ledger.deliveryRate = ledger.sent.length ? ledger.deliveryObserved / ledger.sent.length : 0;
ledger.duplicateDeliveries = Object.values(ledger.received).reduce((sum, count) => sum + Math.max(0, count - 1), 0);
ledger.ackP95Ms = percentile(0.95);
ledger.generatedAt = new Date().toISOString();
const output = process.env.OUTPUT_FILE || `tools/.generated/outage-${faultService}.json`;
await fs.mkdir(new URL("./.generated/", import.meta.url), { recursive: true });
await fs.writeFile(output, JSON.stringify(ledger, null, 2));
console.log(JSON.stringify(ledger, null, 2));
if (ledger.failures.length || ledger.acknowledged < ledger.sent.length) process.exitCode = 1;
