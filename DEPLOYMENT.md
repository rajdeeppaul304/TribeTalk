# TribeTalk deployment guide

## Run the full application with Docker

1. Create the backend environment file from the template:

   ```powershell
   Copy-Item TribetalkBackend/.env.example TribetalkBackend/.env
   ```

2. Replace `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` in `TribetalkBackend/.env` with two long random values. Do not commit this file.

3. Start the stack:

   ```powershell
   docker compose up --build -d
   ```

4. Open [http://localhost:8080](http://localhost:8080). The browser talks only to Nginx; Nginx routes `/api` and `/socket.io` internally to the backend.

   API documentation is available at [http://localhost:8080/api/docs](http://localhost:8080/api/docs), and the service health endpoint is [http://localhost:8080/api/health](http://localhost:8080/api/health).

5. Stop it with:

   ```powershell
   docker compose down
   ```

MongoDB and Redis data persist in the `mongo-data` and `redis-data` Docker volumes. To remove them intentionally, run `docker compose down -v`.

## Deploy to a server

1. Install Docker Engine and Docker Compose on the host.
2. Copy the repository and create `TribetalkBackend/.env` as above.
3. Set the public URL and secure-cookie setting before starting the stack. For example:

   ```powershell
   $env:PUBLIC_ORIGIN = "https://chat.example.com"
   $env:COOKIE_SECURE = "true"
   docker compose up --build -d
   ```

4. For a real HTTPS deployment, point your domain DNS A record at the server, obtain a Let's Encrypt certificate, then set `DOMAIN`, `PUBLIC_ORIGIN=https://your-domain`, and `COOKIE_SECURE=true`. Start the TLS overlay:

   ```powershell
   docker compose -f docker-compose.yml -f docker-compose.production.yml up --build -d
   ```

   The production Nginx layer terminates TLS, redirects HTTP to HTTPS, enables compression/static caching, and preserves Socket.IO WebSocket upgrades. Certificates are intentionally not stored in this repository.
5. Use a managed MongoDB service or add backups before treating the deployment as production.

## MongoDB backups

The repository includes repeatable backup scripts. They create compressed archives and remove backups older than the retention window:

```powershell
./deploy/backup/mongodb-backup.ps1 -OutputDirectory ./backups/mongo -RetentionDays 14
```

On Linux:

```bash
chmod +x deploy/backup/mongodb-backup.sh
./deploy/backup/mongodb-backup.sh ./backups/mongo 14
```

Copy the resulting archive directory to durable storage such as S3, Backblaze B2, or another host. To restore a selected archive into the running Mongo container:

```bash
docker compose exec -T mongo mongorestore --drop --archive --gzip < backups/mongo/tribetalk-YYYYMMDD-HHMMSS/mongo.archive.gz
```

Schedule the backup command with cron or Task Scheduler and periodically perform a restore drill. Backups are not useful until restoration has been verified.

## Resume-ready demo checklist

- Deploy using a domain you control and HTTPS; then add its URL to your README.
- Create a separate low-privilege demo account manually after deployment. Do not commit its password or API tokens—list credentials only where you deliberately share the demo.
- Add a strong `ADMIN_PASSWORD` to the backend environment. The `/admin` page sends it once to the backend and receives a two-hour, HTTP-only admin session cookie; the password is never included in frontend code. The dashboard reports request/error totals, active socket users, socket connections, message throughput, service health, and process uptime.
- Keep production logs as JSON (`LOG_LEVEL=info`); request IDs are returned in `X-Request-ID` and included in HTTP logs.
- Run the optional observability profile for Prometheus/Grafana/Loki, and keep `METRICS_TOKEN` private.

## Local non-Docker development

Run MongoDB locally, then start the backend and frontend in separate terminals:

```powershell
cd TribetalkBackend
npm run dev
```

```powershell
cd TribeTalkFrontend
npm run dev
```

The frontend `.env` defaults point to `http://localhost:3000`; Docker overrides them with same-origin proxy paths at build time.

## Friend-laptop backend and observability demo

This setup keeps the frontend on Vercel and runs the backend plus its data and observability services on another laptop. It is a demo/test environment, not a production deployment.

The laptop runs two backend replicas, MongoDB, Redis, Elasticsearch, Nginx, Prometheus, Grafana, Loki, Promtail, and the exporters. The frontend container is disabled. Nginx exposes:

- `/api/` and `/socket.io/` for the Vercel frontend
- `/grafana/` for Grafana
- `/prometheus/` for Prometheus
- `/loki/` for Loki's HTTP API

### One-time domain setup

1. Put `rajdeep.app` on Cloudflare DNS. If the domain is registered elsewhere, change its nameservers to the Cloudflare nameservers first.
2. In Cloudflare Zero Trust, create a Tunnel and copy its tunnel token.
3. Add a public hostname for the tunnel:
   - Recommended: `backend-tribetalk.rajdeep.app` (use a hyphen; underscores are not valid normal hostnames).
   - Service: `http://gateway:80`.
4. Keep `tribetalk.rajdeep.app` pointed to the Vercel project.

### Vercel frontend

1. Import the GitHub repository into Vercel.
2. Set the project root directory to `TribeTalkFrontend`.
3. Use the Vite build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add these Vercel environment variables for Production:

   ```text
   VITE_API_URL=https://backend-tribetalk.rajdeep.app/api/v1
   VITE_SOCKET_URL=https://backend-tribetalk.rajdeep.app
   ```

5. Add `tribetalk.rajdeep.app` as a Vercel custom domain and configure the DNS record Vercel provides.
6. The setup script asks for this Vercel URL and configures backend CORS and secure cookies accordingly.

### Friend's laptop

1. Install Docker Desktop and enable the Linux engine.
2. Clone the repository.
3. Open PowerShell in the repository root and run:

   ```powershell
   .\deploy\friend-demo\setup-friend-demo.ps1
   ```

4. Enter:
   - Vercel URL: `https://tribetalk.rajdeep.app`
   - Public backend URL: `https://backend-tribetalk.rajdeep.app`
   - Cloudflare Tunnel token
   - A Grafana admin password

The script creates a private backend `.env` if one does not exist, generates JWT/metrics/admin secrets, generates the Prometheus config with the correct metrics token, builds the constrained stack, and starts the tunnel.

For a Linux VM inside VirtualBox, use the Bash version instead:

```bash
chmod +x deploy/friend-demo/setup-friend-demo.sh
./deploy/friend-demo/setup-friend-demo.sh
```

The Linux VM needs Docker Engine, Docker Compose v2, OpenSSL, and Git. Docker should run inside the VM, not through a Windows Docker Desktop socket. With Cloudflare Tunnel enabled, the VM does not need inbound port forwarding; the tunnel makes an outbound connection to Cloudflare and routes traffic to the internal `gateway` container.

VirtualBox NAT is sufficient for the tunneled setup. Use bridged networking only if you want other devices on the same LAN to reach the VM directly. If the tunnel is disabled and the Windows host must open the local gateway, add a VirtualBox NAT rule from host port `8080` to guest port `8080`.

The resulting URLs are:

```text
Frontend:    https://tribetalk.rajdeep.app
Health:      https://backend-tribetalk.rajdeep.app/api/health
Swagger:     https://backend-tribetalk.rajdeep.app/api/docs
Grafana:     https://backend-tribetalk.rajdeep.app/grafana/
Prometheus:  https://backend-tribetalk.rajdeep.app/prometheus/
Loki API:    https://backend-tribetalk.rajdeep.app/loki/
```

Grafana login is `admin` plus the password entered by the friend. MongoDB, Redis, Elasticsearch, and the Docker socket are not exposed publicly. To stop the demo:

```powershell
docker compose -f docker-compose.yml -f docker-compose.local-scale.yml -f docker-compose.friend-demo.yml --profile observability --profile tunnel down
```

To inspect it locally without a tunnel, leave the token blank in the setup script and open `http://localhost:8080`, `http://localhost:8080/grafana/`, or `http://localhost:8080/prometheus/` on the laptop.

## API safeguards

- Helmet adds browser-facing security headers.
- All API traffic is rate-limited; login, registration, and token refresh have a stricter limit.
- Zod validates public request bodies, route parameters, and message-history query parameters before controller code runs.
- Run backend tests with `npm test` from `TribetalkBackend`.

## Redis

Docker starts Redis automatically. It provides shared request-rate counters, shared Socket.IO event delivery when multiple backend containers are running, and short-lived presence keys for active sockets. The health endpoint reports the Redis connection state.

Socket.IO now applies Zod payload validation and a Redis-backed, per-user event rate limit before each recognized event handler. The stricter limits apply to message sends, typing events, edits/deletes, reactions, and pins; the guard uses an in-memory fallback only when Redis is intentionally unavailable in local development.

For non-Docker development, set `REDIS_URL=redis://127.0.0.1:6379` to enable these features. If `REDIS_URL` is omitted, TribeTalk continues with local in-memory rate limits and a single-instance Socket.IO server.

## Elasticsearch message search

Docker starts Elasticsearch automatically. New, edited, and deleted messages are synchronized to a dedicated search index. Search results are always filtered to channels the requesting user can access.

After updating to this version, rebuild the stack with `docker compose up --build -d`. Messages created after Elasticsearch is available are searchable from **Search messages** in the sidebar. The health endpoint reports the Elasticsearch connection state.

## End-to-end browser tests

Playwright exercises the real browser application against the running Docker stack: it verifies that protected pages redirect to login, then registers a unique user, logs in, and updates that user's profile.

Install its Chromium browser once:

```powershell
cd TribetalkBackend
npx playwright install chromium
```

With Docker running at `http://localhost:8080`, execute:

```powershell
npm run test:e2e
```

To test another deployed environment, set `PLAYWRIGHT_BASE_URL` first.

## Profile feature

Authenticated users can edit their display name, avatar URL, and bio from **My Profile**. Clicking a message author's name opens their public profile; public responses never include email addresses, passwords, or refresh tokens.

## Cloudinary image uploads

TribeTalk accepts PNG, JPEG, WebP, and GIF images up to 5 MB. Images are uploaded through the authenticated API, stored in Cloudinary, and only their metadata and secure URL are stored in MongoDB.

1. Create a Cloudinary account and copy its cloud name, API key, and API secret from the dashboard.
2. Add the following values to `TribetalkBackend/.env`:

   ```text
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

3. Rebuild and restart the application:

   ```powershell
   docker compose up --build -d
   ```

Without those values, text chat and profiles continue to work, while image uploads return a clear configuration error.
