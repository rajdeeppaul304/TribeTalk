import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { createRequire } from "node:module";

const exec = promisify(execFile);
const baseUrl = process.env.BASE_URL || "http://localhost:8080";
const loadTestKey = process.env.LOAD_TEST_KEY || "local-only-load-test";
const password = process.env.SOCKET_LOAD_PASSWORD || "LoadTest123!";
const prefix = process.env.SOCKET_USER_EMAIL_PREFIX || "socket_load_";
const limit = Number(process.env.SOCKET_RECOVER_LIMIT || 15000);
const concurrency = Number(process.env.SOCKET_RECOVER_CONCURRENCY || 50);
const tokenFile = process.env.SOCKET_TOKEN_FILE || "tools/.generated/socket-users-recovered.json";
const direct = process.env.SOCKET_RECOVER_MODE !== "login";
const require = createRequire(import.meta.url);
const jwt = require("../TribetalkBackend/node_modules/jsonwebtoken");
const envText = await fs.readFile("TribetalkBackend/.env", "utf8");
const envValues = Object.fromEntries(envText.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).replace(/^\"|\"$/g, "")]; }));
const scenarioFile = process.env.SOCKET_SCENARIO_FILE || "tools/.generated/socket-scenario.json";
let serverId = process.env.SOCKET_SERVER_ID || "";
try { serverId = serverId || JSON.parse(await fs.readFile(scenarioFile, "utf8")).serverId; } catch { /* explicit server id can be supplied */ }

const filter = serverId ? `{_id: {$in: db.servers.findOne({_id: ObjectId('${serverId}')}).members}, email: /^${prefix}/}` : `{email: /^${prefix}/}`;
const mongoScript = `EJSON.stringify(db.users.find(${filter}, {email: 1, username: 1, _id: 1}).sort({_id: 1}).limit(${limit}).toArray())`;
const { stdout } = await exec("docker", ["exec", "tribetalk-mongo-1", "mongosh", "tribetalk", "--quiet", "--eval", mongoScript], { windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
const line = stdout.trim().split(/\r?\n/).at(-1);
const users = JSON.parse(line || "[]");
if (!users.length) throw new Error(`No users found with email prefix ${prefix}`);
console.log(`Found ${users.length} existing synthetic users; recovery mode: ${direct ? "direct local JWT" : "login"}`);

if (direct) {
  const tokens = users.map((user) => jwt.sign({ _id: user._id.$oid || String(user._id), email: user.email, username: user.username }, envValues.ACCESS_TOKEN_SECRET, { expiresIn: "1h" }));
  await fs.mkdir(path.dirname(tokenFile), { recursive: true });
  await fs.writeFile(tokenFile, JSON.stringify(tokens));
  console.log(JSON.stringify({ users: users.length, tokens: tokens.length, tokenFile, mode: "direct-local-jwt" }, null, 2));
  process.exit(0);
}

const headers = { "content-type": "application/json", "x-tribetalk-load-test": loadTestKey };
const login = async (email) => {
  const response = await fetch(`${baseUrl}/api/v1/users/login`, { method: "POST", headers, body: JSON.stringify({ email, password }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${email}: ${response.status} ${body?.message || "login failed"}`);
  return body?.data?.accessToken || body?.accessToken;
};

const tokens = [];
let next = 0;
const worker = async () => {
  while (true) {
    const index = next++;
    if (index >= users.length) return;
    tokens[index] = await login(users[index].email);
    if ((index + 1) % 100 === 0) {
      await fs.mkdir(path.dirname(tokenFile), { recursive: true });
      await fs.writeFile(tokenFile, JSON.stringify(tokens));
      console.log(`Recovered ${index + 1}/${users.length} tokens`);
    }
  }
};
await Promise.all(Array.from({ length: Math.min(concurrency, users.length) }, worker));
await fs.mkdir(path.dirname(tokenFile), { recursive: true });
await fs.writeFile(tokenFile, JSON.stringify(tokens));
console.log(JSON.stringify({ users: users.length, tokens: tokens.filter(Boolean).length, tokenFile }, null, 2));
