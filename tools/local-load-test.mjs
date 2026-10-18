import { randomUUID } from "node:crypto";
import { io } from "../TribeTalkFrontend/node_modules/socket.io-client/build/esm/index.js";

const baseUrl = process.env.LOAD_TEST_URL || "http://localhost:8080";
const durationMs = Number(process.env.LOAD_TEST_DURATION_MS || 120000);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 3);
const password = "LoadTest123!";
const loadTestKey = process.env.LOAD_TEST_KEY || "local-only-load-test";
let completed = 0;
let failed = 0;

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON response */ }
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path} -> ${response.status}`);
  return body;
};

const authHeader = (token) => ({ authorization: `Bearer ${token}` });
const loadTestHeader = { "x-tribetalk-load-test": loadTestKey };

const registerAndLogin = async (label) => {
  const email = `load-${label}-${Date.now()}-${randomUUID().slice(0, 8)}@example.com`;
  const username = `load_${label}_${randomUUID().slice(0, 8)}`;
  await request("/api/v1/users/register", { method: "POST", headers: loadTestHeader, body: JSON.stringify({ email, username, password }) });
  const login = await request("/api/v1/users/login", { method: "POST", headers: loadTestHeader, body: JSON.stringify({ email, password }) });
  return login.data.accessToken;
};

const setupScenario = async () => {
  const ownerToken = await registerAndLogin("owner");
  const ownerHeaders = authHeader(ownerToken);
  await request("/api/v1/users/profile", { method: "PATCH", headers: ownerHeaders, body: JSON.stringify({ bio: "Local observability workload owner" }) });
  const created = await request("/api/v1/server/create-server", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ name: `Load Test ${Date.now()}`, description: "Local observability workload" }) });
  const server = created.data;
  const serverId = server._id;
  const inviteCode = server.inviteCode;
  const serverInfo = await request(`/api/v1/server/single-server/${serverId}`, { headers: ownerHeaders });
  let channel = serverInfo.data?.channels?.[0];
  if (!channel) {
    const createdChannel = await request("/api/v1/channels/create-channel", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ serverId, name: "load-test", description: "Generated workload channel" }) });
    channel = createdChannel.data;
  }
  const workers = await Promise.all(Array.from({ length: concurrency }, async (_, index) => {
    const token = await registerAndLogin(`worker-${index + 1}`);
    const headers = authHeader(token);
    await request("/api/v1/users/profile", { method: "PATCH", headers, body: JSON.stringify({ bio: `Local load worker ${index + 1}` }) });
    await request(`/api/v1/server/join-server/${serverId}`, { method: "POST", headers, body: JSON.stringify({ inviteCode }) });
    return { token, channelId: channel._id };
  }));
  return workers;
};

const connectSocket = (token, channelId) => new Promise((resolve, reject) => {
  const socket = io(baseUrl, { auth: { token }, transports: ["websocket", "polling"] });
  const timeout = setTimeout(() => { socket.disconnect(); reject(new Error("socket connection timeout")); }, 10000);
  socket.once("connect", () => { clearTimeout(timeout); socket.emit("join_channel", { channelId, lastKnownSequence: 0 }); resolve(socket); });
  socket.once("connect_error", (error) => { clearTimeout(timeout); reject(error); });
});

const sendMessage = (socket, channelId, content) => new Promise((resolve, reject) => {
  const clientId = randomUUID();
  const timeout = setTimeout(() => reject(new Error("message acknowledgement timeout")), 10000);
  socket.emit("send_message", { channelId, content, clientId }, (result) => {
    clearTimeout(timeout);
    if (!result?.ok) reject(new Error(result?.error || "message send failed"));
    else resolve(result.message);
  });
});

const worker = async (workerId, scenario, endAt) => {
  const headers = authHeader(scenario.token);
  let socket;
  try {
    socket = await connectSocket(scenario.token, scenario.channelId);
    while (Date.now() < endAt) {
      try {
        const content = `load worker ${workerId} ${randomUUID()}`;
        await sendMessage(socket, scenario.channelId, content);
        await request(`/api/v1/messages/${scenario.channelId}/messages?limit=20`, { headers });
        await request(`/api/v1/search/messages?q=${encodeURIComponent("load worker")}&limit=10`, { headers });
        await request("/api/v1/users/current-user", { headers });
        completed += 1;
      } catch (error) {
        failed += 1;
        console.error(`worker ${workerId}: ${error.message}`);
        if (error.message.includes("sending messages too quickly")) {
          await new Promise((resolve) => setTimeout(resolve, 10500));
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 700 + Math.random() * 700));
    }
  } catch (error) {
    failed += 1;
    console.error(`worker ${workerId}: ${error.message}`);
  } finally {
    socket?.disconnect();
  }
};

console.log(`Preparing register/login/server/channel flow through ${baseUrl}...`);
const scenarios = await setupScenario();
console.log(`Generating mixed local workload for ${durationMs}ms with ${concurrency} workers...`);
await Promise.all(scenarios.map((scenario, index) => worker(index + 1, scenario, Date.now() + durationMs)));
console.log(`Load test complete: ${completed} mixed iterations, ${failed} failed workers.`);
