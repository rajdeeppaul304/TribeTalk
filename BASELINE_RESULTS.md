# Local constrained baseline

Run date: 2026-10-21

This is a repeatable local baseline, not a production capacity claim.

## Resource profile

| Component | CPU limit | Memory limit |
| --- | ---: | ---: |
| backend-1 | 1 vCPU | 1 GB |
| backend-2 | 1 vCPU | 1 GB |
| MongoDB | 0.5 vCPU | 1 GB |
| Redis | 0.25 vCPU | 256 MB |
| Elasticsearch | 0.75 vCPU | 1 GB |
| Frontend/Nginx | 0.25 vCPU | 256 MB |

Prometheus, Grafana, Loki, Promtail, and exporters remained enabled with their local observability limits.

## Results

### Cache comparison

Identical 30-second k6 workload, 10 VUs, 0.25-second sleep, authenticated current-user/server/channel-history/search requests, run through the Docker network:

| Mode | Requests | Error rate | p50 | p95 | p99 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Cache enabled | 4,915 | 0% | 6.49 ms | 30.76 ms | not exported |
| Cache disabled | 4,460 | 0% | 9.41 ms | 64.03 ms | not exported |

Measured p95 reduction: approximately 52%. This is workload-specific and should not be presented as a universal API improvement.

An expanded mixed workload (server/profile/search/history/unread reads) produced 82.36 ms p95 with cache enabled versus 76.60 ms with cache disabled. That result is expected: most of that workload is not cache-backed, so Redis adds a small round-trip without reducing the MongoDB work. On an isolated cacheable workload (server list, server detail, and public profiles), p95 was 18.34 ms enabled versus 35.18 ms disabled, an approximately 47.9% reduction. The cache claim should therefore be described as workload-specific.

### Message delivery ledger

1,000 messages with reconnects every 100 messages:

- acknowledged: 1,000/1,000
- delivered: 1,000/1,000
- duplicates: 0
- acknowledgement p95: 22.63 ms

### Dependency failure

With Elasticsearch stopped, 200 messages remained acknowledged and delivered with zero duplicates; acknowledgement p95 was 21.95 ms.

The Redis scenario did not constitute a full failover test because existing connections remained alive while Redis was stopped. A real Redis failover/reconnect test is still required before making a resilience claim.

The controlled recovery harness then stopped and restarted Redis during a 100-message run: 99 messages were acknowledged and delivered, one acknowledgement was lost, and there were zero duplicates. This is useful evidence of graceful degradation, but it does not support a 99.9% delivery claim yet.

A backend-replica restart during a 100-message run produced 100 acknowledgements, 100 deliveries, zero duplicates, one reconnect, and an acknowledgement p95 of 23.39 ms. This is a passing small-sample recovery result, not a long-duration reliability proof.

### Elasticsearch search

10,000 generated documents and 500 direct search runs under the 1-GB Elasticsearch limit:

- p50: 4.55 ms
- p95: 62.11 ms
- p99: 91.47 ms
- maximum: 307.73 ms

This does not support the previous “1M documents under 15 ms p95” claim.

The 1-million-document run completed under the same 1-GB Elasticsearch limit. The benchmark index occupied 78.8 MB (one primary and one replica; Elasticsearch reported yellow because the single-node setup cannot allocate the replica). Across 200 direct search runs:

- p50: 215.07 ms
- p95: 306.65 ms
- p99: 493.97 ms
- maximum: 3,598.24 ms

The previous “under 15 ms p95” number is not supported on this constrained setup. The likely limiting factors are the 1-GB heap/container limit, a broad `multi_match` query, and an intentionally cold/low-resource single-node benchmark. A production search target would require a larger heap, tuned mappings/query fields, warmup, and a separately measured API/network budget.

After narrowing the benchmark to `match(content, operator=and)`, disabling total-hit counting, limiting `_source`, warming the index, and measuring separately from indexing, the same existing 1M-document index measured:

- sequential, 50 warmup + 200 measured searches: p50 **5.57 ms**, p95 **80.77 ms**, p99 **84.36 ms**
- eight concurrent searches, 100 warmup + 400 measured searches: p50 **90.31 ms**, p95 **99.52 ms**, p99 **103.41 ms**

These are not directly comparable to the earlier cold/broad-query result because the workload changed intentionally. They demonstrate that query shape and warmup were major contributors. The local Compose profile now defaults Elasticsearch to 2 GB memory, 1 CPU, and a 1 GB heap; apply that profile after other active load tests finish.

### WebSocket capacity

5,000 websocket-only connections through the internal Docker network:

- connected: 5,000/5,000
- errors: 0
- hold duration: 30 seconds

All connections used one test identity, so this measures connection capacity and replica routing, not realistic multi-user behavior.

A distinct-user ramp harness was added and validated at 100 users: 100/100 sockets connected and held for 10 seconds with no connection errors. It provisions real users, joins them to a generated server, and persists tokens so the test can be expanded to 500, 1,000, 5,000, and beyond. The 5,000-user result is intentionally not claimed until the larger run is executed.

## Interpretation

The exact résumé figures should be replaced with measured values only after repeating these tests with longer durations, realistic multi-user traffic, and exported p99/error/replica-distribution data.
