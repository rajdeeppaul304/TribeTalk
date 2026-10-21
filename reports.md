# TribeTalk — Performance, Reliability, and Observability Report

Test date: 22 October 2026  
Environment: local Docker Compose horizontal-scale environment  
Purpose: document reproducible results for the current TribeTalk implementation.

## Executive summary

The results below were produced locally with repeatable scripts and Prometheus/Grafana monitoring. The backend ran as two replicas behind Nginx. MongoDB was the durable message store, Redis handled shared ephemeral state and queues, and Elasticsearch handled search indexing.

Achieved results:

- 108 backend tests passing.
- 80.00% statement coverage and 85.11% line coverage.
- 20 custom Prometheus metric families and 7 alert rules.
- Approximately 9% fewer MongoDB reads for the measured cache workload.
- Approximately 48% lower API p95 with caching enabled.
- 18.13 ms message-acknowledgement p95 while Elasticsearch was stopped and restarted.
- 5,000/5,000 Socket.IO connections held for 30 seconds with zero connection errors.
- 100% delivery and zero duplicates in the completed 30-message forced-reconnect test.

These numbers describe the documented local environment and workload.

## 1. Test environment

The local scale overlay limits each service as follows:

| Service | CPU limit | Memory limit |
|---|---:|---:|
| backend-1 | 1 vCPU | 1 GB |
| backend-2 | 1 vCPU | 1 GB |
| MongoDB | 0.5 vCPU | 1 GB |
| Redis | 0.25 vCPU | 256 MB |
| Elasticsearch | 1 vCPU | 2 GB |
| Elasticsearch JVM heap | — | 1 GB |
| Frontend/Nginx | 0.25 vCPU | 256 MB |

Verify the effective configuration:

    docker compose -f docker-compose.yml -f docker-compose.local-scale.yml config

Start the environment:

    docker compose -f docker-compose.yml -f docker-compose.local-scale.yml --profile observability up -d --build

The benchmark account reads BASE_URL, ACCESS_TOKEN, and CHANNEL_ID from tools/.env.loadtest.local. Tokens and credentials must not be committed.

## 2. Methodology and tooling

- Prometheus for counters, histograms, CPU, memory, socket, and dependency metrics.
- Grafana for dashboards and comparisons.
- Loki/Promtail for container logs.
- JSON evidence under tools/.generated/.
- k6 for HTTP workloads.
- Custom Socket.IO tools for connections and delivery.
- An independent client-message ledger for reliability tests.

Cache, search, socket, and outage tests are measured separately. Warm-up, Docker limits, concurrency, duration, percentile latency, and error rates are recorded.

## 3. API rate limiting

Current configuration:

- General API: 500 requests per IP per 15 minutes.
- Authentication routes: 20 requests per IP per 15 minutes.

Exceeded requests return HTTP 429.

## 4. Automated tests and coverage

Run:

    cd TribetalkBackend
    npm test

Result: 108 tests passing across 18 test files.

Run:

    npm run test:coverage

Measured coverage:

| Metric | Result |
|---|---:|
| Statements | 80.00% |
| Lines | 85.11% |
| Branches | 65.38% |
| Functions | 73.92% |

Coverage is code execution by tests; it is not a direct code-quality score.

## 5. Observability

Run:

    $line = Get-Content TribetalkBackend/.env | Where-Object { $_ -match '^METRICS_TOKEN=' } | Select-Object -First 1
    $env:METRICS_TOKEN = $line.Substring('METRICS_TOKEN='.Length)
    $env:BASE_URL = 'http://localhost:8080'
    node tools/audit-observability.mjs

Evidence: tools/.generated/observability-audit.json.

Measured:

- 20 custom Prometheus metric families.
- 31 default Node/process metric families from prom-client.
- 7 Prometheus alert rules.

The alerts cover backend availability, HTTP errors, Redis errors, Elasticsearch errors, MongoDB message latency, socket errors, and MongoDB pool pressure.

## 6. Redis cache comparison

The measured cache workload produced approximately 9% fewer MongoDB reads with caching enabled. Message writes are not expected to benefit as much as repeated reads.

Set the variable before recreating the backend containers, then run the same k6 workload with CACHE_ENABLED=true and then CACHE_ENABLED=false:

    $env:CACHE_ENABLED='true'
    docker compose -f docker-compose.yml -f docker-compose.local-scale.yml up -d --build backend-1 backend-2
    docker run --rm --network host -e BASE_URL=http://localhost:8080 -e ACCESS_TOKEN=<token> -e VUS=10 -e DURATION=2m -v E:/crucial_files/Projects/TribeTalk/tools/k6:/scripts grafana/k6 run /scripts/cache-api.js

Repeat the same commands with $env:CACHE_ENABLED='false'. Keep VUs, duration, endpoint mix, warm-up, and Docker limits unchanged.

Compare Mongo query counters and cache hit/miss counters:

    Mongo read reduction = (reads without cache - reads with cache) / reads without cache

## 7. API latency comparison

Under identical Docker limits, workload, warm-up, VUs, and duration:

| Mode | p95 |
|---|---:|
| Cache disabled | approximately 60 ms |
| Cache enabled | approximately 30 ms |

This is an approximately 48% p95 reduction for the tested read workload.

## 8. Elasticsearch outage and message acknowledgement

Elasticsearch indexing is outside the acknowledgement path:

    Socket message
      -> validate and authorize
      -> persist message in MongoDB
      -> acknowledge sender
      -> create outbox event asynchronously
      -> BullMQ/Redis worker indexes Elasticsearch

Run:

    $env:FAULT_SERVICE='elasticsearch'
    $env:OUTAGE_MESSAGES='20'
    $env:FAULT_AFTER_MS='1000'
    $env:FAULT_DURATION_MS='2000'
    $env:MESSAGE_INTERVAL_MS='25'
    $env:ACK_TIMEOUT_MS='1000'
    node tools/part2-outage-benchmark.mjs

Achieved result:

- 20/20 acknowledged.
- Acknowledgement p95: 18.13 ms.
- 20/20 observed delivered.
- Delivery rate: 100%.
- Duplicate deliveries: 0.
- Failures: 0.

Elasticsearch was stopped and restarted during the run. Indexing is recovered asynchronously through the outbox and BullMQ worker. Redis outage behavior is a separate exercise.

Evidence: tools/.generated/outage-elasticsearch.json.

## 9. Elasticsearch search benchmark

Search latency depends on query shape. Narrow channel-filtered searches are much faster than production-shaped queries with filtering, sorting, highlighting, and source retrieval. A previous production-shaped measurement was:

- Average: 53.94 ms.
- p95: 85.87 ms.
- p99: 100.10 ms.

If the benchmark index already contains 1M documents, do not run generate-and-search: that mode recreates the benchmark index by default. Measure the existing index with search mode instead:

    $env:ES_MODE='search'
    $env:ES_INDEX='tribetalk-benchmark-messages'
    $env:ES_RUNS='1000'
    $env:ES_WARMUP='50'
    $env:ES_QUERY='distributed systems reliability'
    node tools/part3-es-benchmark.mjs

The same existing-index command in copy/paste form is:

    $env:ES_MODE="search"
    $env:ES_INDEX="tribetalk-benchmark-messages"
    $env:ES_RUNS="1000"
    $env:ES_WARMUP="50"
    $env:ES_QUERY="distributed systems reliability"
    node tools/part3-es-benchmark.mjs

### Plain search

This measures a narrow content search with no highlighting or sort. It is the fast
search path that previously produced roughly 10 ms p95 in the local benchmark:

    $env:ES_MODE="search"
    $env:ES_INDEX="tribetalk-benchmark-messages"
    $env:ES_REALISTIC="false"
    $env:ES_QUERY_MODE="match"
    $env:ES_CHANNELS="0"
    $env:ES_RUNS="1000"
    $env:ES_WARMUP="50"
    $env:ES_QUERY="distributed systems reliability"
    node tools/part3-es-benchmark.mjs

Record the p50, p95, p99, maximum latency, document count, and concurrency.

Measured plain-search result:

    min:  3.93 ms
    p50:  5.45 ms
    p95:  7.68 ms
    p99: 36.74 ms
    max: 74.73 ms

### Production-shaped search

This adds result highlighting and score/date sorting. It represents the heavier
search UI path and previously produced approximately 85–100 ms p95/p99 locally:

    $env:ES_MODE="search"
    $env:ES_INDEX="tribetalk-benchmark-messages"
    $env:ES_REALISTIC="true"
    $env:ES_QUERY_MODE="match"
    $env:ES_CHANNELS="0"
    $env:ES_RUNS="1000"
    $env:ES_WARMUP="50"
    $env:ES_QUERY="distributed systems reliability"
    node tools/part3-es-benchmark.mjs

Run both modes against the same already-warm index, with the same run count and
resource limits. The difference is query work: the production-shaped mode returns
highlights and sorts results, while the plain mode only measures matching and source
retrieval.

Measured production-shaped result:

    track total hits: false
    source fields:    7
    min:              47.74 ms
    p50:              50.36 ms
    p95:              69.76 ms
    p99:              99.44 ms
    max:              298.93 ms

To create a fresh isolated 1M-document benchmark index:

    $env:ES_MODE='generate-and-search'
    $env:ES_DOCS='1000000'
    $env:ES_BATCH_SIZE='1000'
    $env:ES_RUNS='1000'
    $env:ES_QUERY='distributed systems reliability'
    node tools/part3-es-benchmark.mjs

Inspect index size:

    Invoke-RestMethod 'http://localhost:9200/_cat/indices/tribetalk-benchmark-messages?v'

Include document count, mappings, JVM heap, warm-up status, query shape, p50, p95, p99, and maximum latency in each search result.

## 10. Concurrent WebSocket connections

The multi-user ramp test provisions distinct users, joins them to the scenario server, opens Socket.IO connections, and holds them for a fixed period.

    $env:SOCKET_USERS='5000'
    $env:SOCKET_STAGES='5000'
    $env:SOCKET_RAMP_PER_SEC='100'
    $env:SOCKET_HOLD_SECONDS='30'
    $env:SOCKET_TOKEN_FILE='tools/.generated/socket-users-recovered.json'
    $env:SOCKET_SCENARIO_FILE='tools/.generated/socket-scenario.json'
    $env:LOAD_TEST_KEY='local-only-load-test'
    node tools/part3-multiuser-socket-ramp.mjs

Achieved result:

- Target: 5,000.
- Connected: 5,000.
- Errors: 0.
- Connection success rate: 100%.
- Hold time: 30 seconds.

Grafana should be used during the run to inspect active sockets, per-replica connections, traffic, CPU, memory, and errors.

## 11. Reconnect and delivery ledger

The forced-reconnect test uses client-generated IDs and an independent ledger. Retrying the same ID is checked for duplicate creation and duplicate delivery.

    $env:FAULT_SERVICE='backend-1'
    $env:FORCE_DISCONNECT_ON_FAULT='true'
    $env:RELIABILITY_MESSAGES='30'
    $env:FAULT_AFTER_MS='1000'
    $env:FAULT_DURATION_MS='3000'
    $env:MESSAGE_INTERVAL_MS='50'
    node tools/part2-failover-recovery.mjs

Achieved result:

- 30 total messages.
- 30 acknowledged.
- 30 delivered.
- Delivery rate: 100%.
- Duplicates: 0.
- Reconnects: 1.
- Failed messages: 0.

This verifies the tested forced-reconnect scenario. A 100,000-message statistical run with multiple restart cycles has not been completed; that would be a separate extended reliability exercise.

## 12. Evidence files

- tools/audit-observability.mjs
- tools/part2-outage-benchmark.mjs
- tools/part2-failover-recovery.mjs
- tools/part3-es-benchmark.mjs
- tools/part3-multiuser-socket-ramp.mjs
- tools/.generated/observability-audit.json
- tools/.generated/outage-elasticsearch.json
- tools/.generated/failover-ledger.json

## 13. Reproducibility standard

For every future run, preserve the Git commit, Docker limits, dependency versions, dataset size, query shape, warm-up duration, concurrency, duration, raw JSON output, and Grafana/Prometheus evidence. This keeps results comparable across code changes.

