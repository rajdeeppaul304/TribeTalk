import http from "node:http";
import fs from "node:fs";

const socketPath = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
const listenPort = Number(process.env.PORT || 9102);
const intervalMs = Number(process.env.POLL_INTERVAL_MS || 5000);
const trackedServices = new Set((process.env.TRACKED_SERVICES || "backend-1,backend-2").split(",").map((value) => value.trim()).filter(Boolean));

let metrics = "# docker stats exporter is warming up\n";

function dockerRequest(path) {
  return new Promise((resolve, reject) => {
    const request = http.request({ socketPath, path, method: "GET", headers: { Accept: "application/json" } }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(`Docker API ${response.statusCode}: ${body}`));
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.on("error", reject);
    request.end();
  });
}

function label(value) {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("\n", "\\n");
}

async function collect() {
  const containers = await dockerRequest("/containers/json?all=0");
  const lines = [
    "# HELP tribetalk_container_memory_working_set_bytes Current container memory usage in bytes.",
    "# TYPE tribetalk_container_memory_working_set_bytes gauge",
    "# HELP tribetalk_container_memory_limit_bytes Configured container memory limit in bytes.",
    "# TYPE tribetalk_container_memory_limit_bytes gauge",
    "# HELP tribetalk_container_cpu_usage_seconds_total Cumulative container CPU time in seconds.",
    "# TYPE tribetalk_container_cpu_usage_seconds_total counter",
  ];
  for (const container of containers) {
    const service = container.Labels?.["com.docker.compose.service"] || "";
    if (!trackedServices.has(service)) continue;
    const stats = await dockerRequest(`/containers/${container.Id}/stats?stream=false`);
    const name = (container.Names?.[0] || container.Id.slice(0, 12)).replace(/^\//, "");
    const labels = `container="${label(name)}",service="${label(service)}",replica="${label(service)}"`;
    const memory = Number(stats.memory_stats?.usage || 0);
    const cache = Number(stats.memory_stats?.stats?.inactive_file || 0);
    const workingSet = Math.max(0, memory - cache);
    const limit = Number(stats.memory_stats?.limit || 0);
    const cpuNs = Number(stats.cpu_stats?.cpu_usage?.total_usage || 0);
    lines.push(`tribetalk_container_memory_working_set_bytes{${labels}} ${workingSet}`);
    lines.push(`tribetalk_container_memory_limit_bytes{${labels}} ${limit}`);
    lines.push(`tribetalk_container_cpu_usage_seconds_total{${labels}} ${cpuNs / 1e9}`);
  }
  metrics = `${lines.join("\n")}\n`;
}

async function poll() {
  try { await collect(); } catch (error) { metrics = `# docker stats exporter error: ${String(error.message).replaceAll("\n", " ")}\n`; }
}

if (!fs.existsSync(socketPath)) console.warn(`Docker socket not found at ${socketPath}`);
await poll();
setInterval(poll, intervalMs).unref();
http.createServer((request, response) => {
  if (request.url === "/health") { response.writeHead(200, { "content-type": "text/plain" }); return response.end("ok\n"); }
  if (request.url !== "/metrics") { response.writeHead(404); return response.end("not found\n"); }
  response.writeHead(200, { "content-type": "text/plain; version=0.0.4; charset=utf-8" });
  response.end(metrics);
}).listen(listenPort, "0.0.0.0", () => console.log(`Docker stats exporter listening on :${listenPort}`));
