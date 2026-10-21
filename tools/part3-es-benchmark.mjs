import { Client } from "../TribetalkBackend/node_modules/@elastic/elasticsearch/index.js";

const url = process.env.ELASTICSEARCH_URL || "http://localhost:9200";
const index = process.env.ES_INDEX || "tribetalk-benchmark-messages";
const count = Number(process.env.ES_DOCS || 10000);
const batchSize = Number(process.env.ES_BATCH_SIZE || 1000);
const queryText = process.env.ES_QUERY || "distributed systems reliability";
const runs = Number(process.env.ES_RUNS || 100);
const warmupRuns = Number(process.env.ES_WARMUP || 20);
const concurrency = Math.max(1, Number(process.env.ES_CONCURRENCY || 1));
const mode = process.env.ES_MODE || "search";
const reset = process.env.ES_RESET !== "false";
const realistic = process.env.ES_REALISTIC === "true";
const queryMode = process.env.ES_QUERY_MODE || "match";
const channelCount = Math.max(0, Number(process.env.ES_CHANNELS || 0));
const client = new Client({ node: url });

const sourceFields = ["messageId", "channelId", "senderId", "senderUsername", "content", "createdAt", "hasAttachments"];
const makeDocument = (number) => ({ messageId: `benchmark-${number}`, channelId: `benchmark-channel-${number % 100}`, senderId: `benchmark-user-${number % 1000}`, senderUsername: `user${number % 1000}`, content: `${queryText} message number ${number}`, createdAt: new Date(Date.now() - (count - number) * 1000).toISOString(), hasAttachments: number % 10 === 0 });

async function ensureIndex() {
  if (await client.indices.exists({ index })) return;
  await client.indices.create({ index, settings: { number_of_shards: 1, number_of_replicas: Number(process.env.ES_REPLICAS || 0), refresh_interval: "30s" }, mappings: { dynamic: false, properties: { messageId: { type: "keyword" }, channelId: { type: "keyword" }, senderId: { type: "keyword" }, senderUsername: { type: "keyword" }, content: { type: "text", index_options: "freqs" }, createdAt: { type: "date" }, hasAttachments: { type: "boolean" } } } });
}

async function generate() {
  if (reset && await client.indices.exists({ index })) await client.indices.delete({ index });
  await ensureIndex();
  for (let start = 0; start < count; start += batchSize) {
    const end = Math.min(start + batchSize, count);
    const operations = [];
    for (let number = start; number < end; number += 1) operations.push({ index: { _index: index, _id: `benchmark-${number}` } }, makeDocument(number));
    const result = await client.bulk({ operations, refresh: false });
    if (result.errors) throw new Error(`Bulk indexing failed near document ${start}`);
    if (end % (batchSize * 10) === 0 || end === count) console.log(`Indexed ${end}/${count}`);
  }
  await client.indices.putSettings({ index, settings: { refresh_interval: "1s" } });
  await client.indices.refresh({ index });
  console.log(`Indexed ${count} documents into ${index}`);
}

const contentQuery = queryMode === "phrase"
  ? { match_phrase: { content: queryText } }
  : { match: { content: { query: queryText, operator: "and" } } };
const contentClause = channelCount > 0
  ? { bool: { filter: [{ terms: { channelId: Array.from({ length: channelCount }, (_, i) => `benchmark-channel-${i}`) } }], must: [contentQuery] } }
  : contentQuery;
const searchBody = {
  size: 20,
  track_total_hits: false,
  _source: sourceFields,
  query: contentClause,
  ...(realistic ? {
    highlight: { fields: { content: {} }, pre_tags: ["<mark>"], post_tags: ["</mark>"] },
    sort: [{ _score: "desc" }, { createdAt: "desc" }],
  } : {}),
};
const searchOnce = async () => { const started = performance.now(); await client.search({ index, ...searchBody }); return performance.now() - started; };

async function benchmark() {
  await client.indices.refresh({ index });
  const countResult = await client.count({ index });
  for (let attempt = 0; attempt < warmupRuns; attempt += 1) await searchOnce();
  const latencies = [];
  for (let start = 0; start < runs; start += concurrency) latencies.push(...await Promise.all(Array.from({ length: Math.min(concurrency, runs - start) }, searchOnce)));
  latencies.sort((a, b) => a - b);
  const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * p) - 1)];
  console.log(JSON.stringify({ index, documents: countResult.count, runs, warmupRuns, concurrency, realistic, channelCount, query: queryText, queryType: queryMode, trackTotalHits: false, sourceFields: sourceFields.length, minMs: latencies[0], p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), maxMs: latencies.at(-1) }, null, 2));
}

try {
  if (mode === "generate") await generate();
  else if (mode === "search") await benchmark();
  else if (mode === "generate-and-search") { await generate(); await benchmark(); }
  else throw new Error("ES_MODE must be generate, search, or generate-and-search");
} finally { await client.close(); }
