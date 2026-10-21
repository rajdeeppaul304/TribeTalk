import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(new URL("../TribeTalkFrontend/package.json", import.meta.url));
const { io } = require("socket.io-client");

const readConfig = async () => {
  try {
    const text = await fs.readFile(new URL("./.env.loadtest.local", import.meta.url), "utf8");
    return Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
  } catch { return {}; }
};

const cfg = await readConfig();
const baseUrl = process.env.BASE_URL || cfg.BASE_URL || "http://localhost:8080";
const channelId = process.env.CHANNEL_ID || cfg.CHANNEL_ID;
const loadTestKey = process.env.LOAD_TEST_KEY || cfg.LOAD_TEST_KEY || "local-only-load-test";
const target = Number(process.env.SOCKET_USERS || 100);
const rampPerSecond = Number(process.env.SOCKET_RAMP_PER_SEC || 100);
const holdSeconds = Number(process.env.SOCKET_HOLD_SECONDS || 30);
const provisionConcurrency = Number(process.env.PROVISION_CONCURRENCY || 25);
const stages = (process.env.SOCKET_STAGES || String(target)).split(",").map(Number).filter(Number.isFinite);
const tokenFile = path.resolve(process.env.SOCKET_TOKEN_FILE || "tools/.generated/socket-users.json");
const scenarioFile = path.resolve(process.env.SOCKET_SCENARIO_FILE || "tools/.generated/socket-scenario.json");

const headers = { "content-type": "application/json", "x-tribetalk-load-test": loadTestKey };
const request = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options.method || "GET"} ${url} -> ${response.status}: ${body?.message || body?.error || "request failed"}`);
  return body;
};

const registerAndLogin = async (index, label = "socket") => {
  // Keep generated usernames well below the API's 32-character limit even
  // when stages reach five or six digits. The UUID keeps reruns unique.
  const suffix = `${Date.now().toString(36).slice(-6)}${randomUUID().slice(0, 6)}${index}`;
  const email = `socket_load_${suffix}@example.com`;
  const username = `sl${suffix}`;
  await request(`${baseUrl}/api/v1/users/register`, { method: "POST", body: JSON.stringify({ email, username, password: "LoadTest123!", confirmPassword: "LoadTest123!" }) });
  const login = await request(`${baseUrl}/api/v1/users/login`, { method: "POST", body: JSON.stringify({ email, password: "LoadTest123!" }) });
  const token = login?.data?.accessToken || login?.accessToken;
  if (!token) throw new Error(`login did not return an access token for ${username}`);
  return token;
};

const ensureScenario = async () => {
  try {
    const saved = JSON.parse(await fs.readFile(scenarioFile, "utf8"));
    if (saved?.channelId && saved?.serverId && saved?.inviteCode) return saved;
  } catch { /* create a local scenario */ }
  const ownerToken = await registerAndLogin(0, "owner");
  const ownerHeaders = { ...headers, authorization: `Bearer ${ownerToken}` };
  const created = await request(`${baseUrl}/api/v1/server/create-server`, { method: "POST", headers: ownerHeaders, body: JSON.stringify({ name: `Socket Ramp ${Date.now()}`, description: "Local multi-user socket benchmark" }) });
  const server = created?.data;
  const createdChannel = await request(`${baseUrl}/api/v1/channels/create-channel`, { method: "POST", headers: ownerHeaders, body: JSON.stringify({ serverId: server._id, name: "socket-load", description: "Socket benchmark channel" }) });
  const scenario = { serverId: server._id, inviteCode: server.inviteCode, channelId: createdChannel?.data?._id };
  if (!scenario.channelId) throw new Error("created benchmark server has no channel");
  await fs.mkdir(path.dirname(scenarioFile), { recursive: true });
  await fs.writeFile(scenarioFile, JSON.stringify(scenario));
  return scenario;
};

const provision = async (count, scenario) => {
  await fs.mkdir(path.dirname(tokenFile), { recursive: true });
  let tokens = [];
  try {
    const existing = JSON.parse(await fs.readFile(tokenFile, "utf8"));
    if (Array.isArray(existing)) {
      tokens = existing.slice(0, count);
      if (tokens.length >= count && tokens.every(Boolean)) return tokens;
    }
  } catch { /* create a fresh token set */ }
  let next = tokens.findIndex((token) => !token);
  if (next < 0) next = tokens.length;
  const worker = async () => { while (true) { const index = next++; if (index >= count) return; try { const token = await registerAndLogin(index); await request(`${baseUrl}/api/v1/server/join-server/${scenario.serverId}`, { method: "POST", headers: { ...headers, authorization: `Bearer ${token}` }, body: JSON.stringify({ inviteCode: scenario.inviteCode }) }); tokens[index] = token; if ((index + 1) % 100 === 0) { await fs.writeFile(tokenFile, JSON.stringify(tokens)); console.log(`Provisioned and joined ${index + 1}/${count} users`); } } catch (error) { throw new Error(`provisioning user ${index + 1}: ${error.message}`); } } };
  await Promise.all(Array.from({ length: Math.min(provisionConcurrency, count) }, worker));
  await fs.writeFile(tokenFile, JSON.stringify(tokens));
  return tokens;
};

const connectStage = async (tokens, stage, activeChannelId) => {
  const sockets = new Set();
  const errors = new Map();
  let connected = 0;
  const connectOne = (token) => new Promise((resolve) => {
    // Disable Socket.IO Manager multiplexing: every synthetic user must own a
    // separate TCP/WebSocket connection, not a namespace on a shared socket.
    const socket = io(baseUrl, { auth: { token, loadTestKey }, transports: ["websocket"], reconnection: false, forceNew: true, multiplex: false, timeout: 10000 });
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };
    socket.once("connect", () => { connected += 1; sockets.add(socket); socket.emit("join_channel", { channelId: activeChannelId, lastKnownSequence: 0 }); finish(); });
    socket.once("connect_error", (error) => { const reason = error?.message || "unknown"; errors.set(reason, (errors.get(reason) || 0) + 1); socket.close(); finish(); });
    setTimeout(() => { if (!settled) { errors.set("connect timeout", (errors.get("connect timeout") || 0) + 1); socket.close(); } finish(); }, 12000);
  });
  for (let offset = 0; offset < stage; offset += rampPerSecond) {
    await Promise.all(tokens.slice(offset, Math.min(offset + rampPerSecond, stage)).map(connectOne));
    console.log(`Stage ${stage}: attempted=${Math.min(offset + rampPerSecond, stage)} connected=${connected} errors=${[...errors.values()].reduce((a, b) => a + b, 0)}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  await new Promise((resolve) => setTimeout(resolve, holdSeconds * 1000));
  for (const socket of sockets) socket.close();
  return { target: stage, connected, errors: Object.fromEntries(errors), connectionSuccessRate: connected / Math.max(1, stage), holdSeconds };
};

const scenario = await ensureScenario();
const effectiveChannelId = channelId || scenario.channelId;
if (!effectiveChannelId) throw new Error("CHANNEL_ID is required");
// connectStage reads the channel from the process environment to keep the
// harness usable with an existing scenario as well as the generated one.
process.env.CHANNEL_ID = effectiveChannelId;
const maxStage = Math.max(...stages);
const tokens = await provision(maxStage, scenario);
for (const stage of stages) {
  const result = await connectStage(tokens, stage, effectiveChannelId);
  console.log(JSON.stringify(result, null, 2));
  if (result.connectionSuccessRate < 0.999) break;
}
