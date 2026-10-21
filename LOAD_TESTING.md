# TribeTalk controlled performance tests

These workloads are local-only and do not change the production Compose deployment.

## Configurable resource scenarios

The local horizontal-scale Compose file accepts per-service limits through environment variables. The intended defaults are one CPU and four GB for each backend replica; the values can be changed for comparison runs.

```powershell
$env:BACKEND_1_CPUS="1"
$env:BACKEND_1_MEMORY="4g"
$env:BACKEND_2_CPUS="1"
$env:BACKEND_2_MEMORY="4g"
docker compose -f docker-compose.yml -f docker-compose.local-scale.yml --profile observability up --build -d
```

Always record the values used with each result. The load generator should run separately so it does not become the bottleneck.

## Part 1 cache/API workload

Run the k6 script in Docker:

```powershell
docker run --rm --network host `
  -e BASE_URL=http://localhost:8080 `
  -e ACCESS_TOKEN="your-test-access-token" `
  -e LOAD_TEST_KEY="local-only-load-test" `
  -e VUS=10 -e DURATION=2m `
  -v "${PWD}/tools/k6:/scripts" `
  grafana/k6 run /scripts/cache-api.js
```

Use Prometheus/Grafana to record:

- `http_req_duration` from k6
- `tribetalk_cache_hits_total`
- `tribetalk_cache_misses_total`
- `tribetalk_cache_writes_total`
- `tribetalk_dependency_requests_total{dependency="mongodb"}`
- MongoDB dependency duration p95

Cache hit ratio is:

```text
cache hits / (cache hits + cache misses)
```

Run the same workload against the same dataset with caching disabled for the baseline, then compare p50/p95/p99 latency and MongoDB reads.

The `LOAD_TEST_KEY` bypass is enabled only by the local-scale development Compose profile. It prevents the normal per-IP API limiter from turning the benchmark into a rate-limit test. Do not enable or expose this bypass in production.

To run the no-cache baseline locally, recreate only the local-scale stack with caching disabled:

```powershell
$env:CACHE_ENABLED="false"
docker compose -f docker-compose.yml -f docker-compose.local-scale.yml --profile observability up --build -d --force-recreate backend-1 backend-2 frontend
```

Run the same k6 command, record the latency and MongoDB counters, then restore the cached run:

```powershell
$env:CACHE_ENABLED="true"
docker compose -f docker-compose.yml -f docker-compose.local-scale.yml --profile observability up -d --force-recreate backend-1 backend-2 frontend
```

## Artillery Socket.IO scaffold

Artillery is included as a separate Socket.IO workload scaffold for the later reliability and concurrency phases:

```powershell
npx artillery run tools/artillery/socketio.yml
```

It is intentionally not used to claim capacity yet; the token and channel ID must be supplied from a test account first.

## Part 2 reliability signals

The backend now exposes these Part 2 metrics:

- `tribetalk_message_delivery_attempts_total`
- `tribetalk_message_delivery_results_total{status="sent|failed"}`
- `tribetalk_duplicate_messages_total`
- `tribetalk_message_ack_duration_seconds`
- `tribetalk_recovery_sync_messages_total`

Run the local failure-injection helper against one dependency or replica:

```powershell
.\tools\part2-failure-injection.ps1 -Target redis
.\tools\part2-failure-injection.ps1 -Target elasticsearch
.\tools\part2-failure-injection.ps1 -Target backend-1
```

During each scenario, run the Artillery Socket.IO workload with `ACCESS_TOKEN` and `CHANNEL_ID` set. Restore the dependency before starting the next scenario. These tests are local-only and do not modify the production Compose files.

## Part 3 search and socket scale

The Elasticsearch benchmark defaults to 10,000 documents and 100 queries. Explicitly choose a larger value before generating a million-document dataset:

```powershell
$env:ES_MODE="generate-and-search"
$env:ES_DOCS="10000"
$env:ES_RUNS="100"
node tools/part3-es-benchmark.mjs
```

Interview-scale experiment:

```powershell
$env:ES_MODE="generate"
$env:ES_DOCS="1000000"
node tools/part3-es-benchmark.mjs
$env:ES_MODE="search"
$env:ES_RUNS="1000"
node tools/part3-es-benchmark.mjs
```

The optimized benchmark performs a warm-up, uses a narrow content `match` query, disables total-hit counting, limits returned fields, and can issue concurrent searches:

```powershell
$env:ES_MODE="search"
$env:ES_DOCS="1000000"
$env:ES_WARMUP="100"
$env:ES_RUNS="400"
$env:ES_CONCURRENCY="8"
$env:ES_RESET="false"
node tools/part3-es-benchmark.mjs
```

Generation and search are separate modes, so indexing time is not mixed into search latency. The local constrained profile defaults to 2 GB for Elasticsearch with a 1 GB JVM heap; override `ELASTICSEARCH_MEMORY`, `ELASTICSEARCH_JAVA_OPTS`, and `ELASTICSEARCH_CPUS` for another scenario.

The output reports search-only p50/p95/p99 latency. API-level search latency should be measured separately against `/api/v1/search/messages`, because that includes authentication, MongoDB channel-access lookup, Redis caching, Nginx, and network overhead.

For the API-level search run, add a query to the k6 workload:

```powershell
$env:SEARCH_QUERY="distributed systems reliability"
```

For Socket.IO ramping:

```powershell
$env:SOCKET_TARGET="100"
$env:SOCKET_RAMP_PER_SEC="10"
$env:SOCKET_HOLD_SECONDS="60"
node tools/part3-socket-ramp.mjs
```

The browser-facing `localhost:8080` path is useful for smoke tests, but Docker Desktop on
Windows can cap a single published host port at roughly 2,000 concurrent connections.
For the 5,000-socket experiment, run the generator inside the Compose network so the
measurement exercises Nginx and both Node replicas rather than the host NAT layer:

```powershell
docker run --rm --network tribetalk_default `
  -v "${PWD}:/work" `
  -v "${PWD}/TribeTalkFrontend/node_modules:/work/TribeTalkFrontend/node_modules" `
  -w /work node:24-alpine sh -c `
  "BASE_URL=http://frontend SOCKET_TARGET=5000 SOCKET_RAMP_PER_SEC=100 SOCKET_HOLD_SECONDS=30 node tools/part3-socket-ramp.mjs"
```

The local-scale Nginx config routes REST API requests round-robin across both replicas,
keeps normal Engine.IO polling handshakes sticky, and routes websocket-only load-test
connections round-robin. Watch
`tribetalk_active_sockets` grouped by `replica`, container CPU/memory, and Nginx errors.
Increase gradually (500, 1000, then higher) and record the exact environment and hold
duration; do not claim 5,000 from a host-port run that tops out around 2,000.

The 1M-search and 5,000-socket claims require recorded resource limits, workload shape, duration, failure rate, and repeatable p95 results. A single local run is not sufficient evidence.

### Distinct-user socket ramp

`part3-multiuser-socket-ramp.mjs` creates real local test users, creates a benchmark server/channel, joins each user, persists their access tokens, and then ramps one socket per user. It is deliberately separate from the one-identity connection test:

```powershell
$env:SOCKET_USERS="100"
$env:SOCKET_STAGES="100,500,1000,5000"
$env:SOCKET_RAMP_PER_SEC="100"
$env:SOCKET_HOLD_SECONDS="30"
$env:PROVISION_CONCURRENCY="25"
node tools/part3-multiuser-socket-ramp.mjs
```

The harness stops at the first stage whose connection success rate falls below 99.9%. Generated credentials are stored under `tools/.generated/` and ignored by Git. Use a new token/scenario file when you want an isolated run.

### Controlled recovery test

This harness connects first, injects a timed backend or Redis stop, reconnects, and tracks acknowledged messages, delivered messages, duplicates, reconnects, and acknowledgement p95:

```powershell
$env:ACCESS_TOKEN="<member access token>"
$env:CHANNEL_ID="<benchmark channel id>"
$env:RELIABILITY_MESSAGES="100"
$env:FAULT_SERVICE="backend-1" # or redis
$env:FAULT_AFTER_MS="3000"
$env:FAULT_DURATION_MS="4000"
node tools/part2-failover-recovery.mjs
```

The script uses the local Compose files to stop/start the selected service. It is local-only and must never be pointed at production. A Redis interruption that loses acknowledgements is reported as a failed resilience result rather than being hidden by the test.
