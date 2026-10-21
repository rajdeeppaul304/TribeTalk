import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.BASE_URL || "http://localhost:8080";
const token = process.env.METRICS_TOKEN || process.env.LOAD_TEST_KEY || "replace-with-metrics-token";
const alertsPath = path.resolve(process.env.ALERTS_FILE || "deploy/observability/tribetalk-alerts.yml");
const response = await fetch(`${baseUrl}/api/metrics?token=${encodeURIComponent(token)}`);
const body = await response.text();
if (!response.ok) throw new Error(`Metrics endpoint returned ${response.status}: ${body.slice(0, 200)}`);

const metricFamilies = new Set();
const defaultMetricFamilies = new Set();
for (const line of body.split(/\r?\n/)) {
  const match = line.match(/^#\s+TYPE\s+([^\s]+)/);
  if (!match || !match[1].startsWith("tribetalk_")) continue;
  if (match[1].startsWith("tribetalk_nodejs_") || match[1].startsWith("tribetalk_process_")) defaultMetricFamilies.add(match[1]);
  else metricFamilies.add(match[1]);
}
const alertText = await fs.readFile(alertsPath, "utf8");
const alertNames = [...alertText.matchAll(/^\s*-\s*alert:\s*(\S+)/gm)].map((match) => match[1]);
const report = {
  generatedAt: new Date().toISOString(),
  metricsUrl: `${baseUrl}/api/metrics`,
  customMetricFamilies: [...metricFamilies].sort(),
  customMetricFamilyCount: metricFamilies.size,
  defaultMetricFamilyCount: defaultMetricFamilies.size,
  alertRules: alertNames,
  alertRuleCount: alertNames.length,
  defaultPromClientMetrics: body.includes("tribetalk_process_cpu_user_seconds_total"),
};
const output = path.resolve(process.env.OUTPUT_FILE || "tools/.generated/observability-audit.json");
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
