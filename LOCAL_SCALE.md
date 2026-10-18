# Local horizontal-scaling demo

This setup is deliberately local-only. It does not change the EC2 production Compose files.

## Start it

Make sure `TribetalkBackend/.env` contains the same metrics token used by `deploy/local-scale/prometheus.yml`:

```env
METRICS_TOKEN=replace-with-metrics-token
```

Start the two backend replicas and observability stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.local-scale.yml --profile observability up --build -d
```

The application is at `http://localhost:8080`. The replicas are `backend-1` and `backend-2`; Nginx sends requests to both.

Run variable load through Nginx from the repository root:

```bash
node tools/local-load-test.mjs
```

Optional settings:

```bash
LOAD_TEST_DURATION_MS=300000 LOAD_TEST_CONCURRENCY=16 node tools/local-load-test.mjs
```

## View the comparison in Grafana

Open `http://localhost:3001` and sign in with the Grafana credentials shown by the container (the default first login is normally `admin` / `admin`). The `TribeTalk - Local horizontal scale` dashboard is provisioned automatically.

The dashboard compares:

- Requests per second for backend-1 vs backend-2
- HTTP errors per replica
- Active sockets per replica
- Message throughput per replica
- Redis memory
- MongoDB operation counters
- Elasticsearch document metrics
- Live Docker logs from Loki

Prometheus is available at `http://localhost:9090`. Use **Status → Target health** to confirm both backends and the exporters are `UP`.

In Grafana **Explore**, the Prometheus data source can query metrics, while the Loki data source can query logs with:

```logql
{job="docker"}
```

To stop only this local demo:

```bash
docker compose -f docker-compose.yml -f docker-compose.local-scale.yml --profile observability down
```

The normal production command and `docker-compose.production.yml` are unchanged.
