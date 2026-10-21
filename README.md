# TribeTalk

TribeTalk is a full-stack, real-time community chat application. Users create servers and channels, exchange text and image messages, invite and moderate members, search conversations, receive mentions, and stay synchronized across reconnects.

> Demo URL: add your deployed HTTPS URL here. Do not publish an administrator password or personal credentials.

## Highlights

- Real-time Socket.IO chat with optimistic delivery, retries, idempotent client IDs, channel sequences, reconnect recovery, and cursor pagination.
- One-to-one direct messages with real-time delivery, idempotent retries, unread notification records, and scheduled channel messages processed by BullMQ.
- Server invites with expiry, revocation, maximum-use limits, owner/moderator/member roles, and moderation audit events.
- Profiles, image avatars/message attachments through Cloudinary, presence, typing, mentions, notifications, reactions, threads, and pins.
- MongoDB as the source of truth; Redis for shared ephemeral state; Elasticsearch for full-text message search.
- Dockerized deployment through Nginx, structured Pino logs, request IDs, health checks, metrics, CI, and browser smoke tests.

## Architecture

```mermaid
flowchart LR
  Browser[React + TypeScript client] -->|HTTPS / REST| Nginx
  Browser -->|WebSocket| Nginx
  Nginx --> API[Express + Socket.IO]
  API --> Mongo[(MongoDB)]
  API --> Redis[(Redis)]
  API --> ES[(Elasticsearch)]
  API --> Cloudinary[Cloudinary]
  API --> Outbox[(Mongo Outbox)]
  Outbox --> BullMQ[BullMQ worker]
  BullMQ --> Resend[Resend email]
  BullMQ --> ES
  Redis <--> Adapter[Socket.IO Redis adapter]
```

## Stack

| Area | Technology | Use in TribeTalk |
| --- | --- | --- |
| Client | React, TypeScript, Redux Toolkit, Tailwind CSS | User interface, state, API cache, socket-driven UI |
| Realtime | Socket.IO | Rooms, reconnects, channel broadcasts, typing, message delivery |
| API | Node.js, Express | REST API, authentication, business rules |
| Primary data | MongoDB, Mongoose | Users, servers, messages, invites, notifications, audit logs |
| Ephemeral/distributed | Redis | Rate limits, presence TTLs, typing TTLs, Socket.IO adapter |
| Search | Elasticsearch | Full-text message search, separate derived index |
| Async jobs | BullMQ, ioredis, Mongo outbox | Retryable auth email delivery and Elasticsearch indexing outside the request path |
| Uploads | Cloudinary, Multer | Authenticated image uploads and delivery |
| Security | JWT, cookies, Helmet, Zod, express-rate-limit | Auth, headers, validation, API/socket abuse controls |
| Delivery | Docker Compose, Nginx | Repeatable local deployment, reverse proxy, WebSocket forwarding |
| Quality | Vitest, Supertest, Playwright, GitHub Actions | API tests, browser smoke tests, CI |
| Observability | Pino | JSON logs, request IDs, metrics, live demo admin view |

## Run locally with Docker

1. Create the backend environment file:

   ```powershell
   Copy-Item TribetalkBackend/.env.example TribetalkBackend/.env
   ```

2. Set strong values for `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, and `ADMIN_PASSWORD`.

3. Start the stack:

   ```powershell
   docker compose up --build -d
   ```

4. Open [http://localhost:8080](http://localhost:8080).

Useful local routes:

- `http://localhost:8080/api/docs` — Swagger UI
- `http://localhost:8080/api/health` — dependency health
- `http://localhost:8080/api/metrics` — protected Prometheus scrape endpoint (`x-metrics-token` header)
- `http://localhost:8080/admin` — demo metrics dashboard; sign in using `ADMIN_PASSWORD`

Stop the stack with `docker compose down`. MongoDB, Redis, and Elasticsearch volumes persist unless you explicitly use `docker compose down -v`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` | JWT signing secrets |
| `CORS_ORIGIN`, `COOKIE_SECURE` | Browser/deployment security settings |
| `REDIS_URL` | Shared Socket.IO, rate-limit, presence, and typing state |
| `ELASTICSEARCH_URL` | Search index connection |
| `CLOUDINARY_*` | Image upload configuration |
| `EMAIL_VERIFICATION_REQUIRED` | Require verified email before login |
| `RESEND_API_KEY`, `EMAIL_FROM` | OTP delivery through Resend; development logs a code if unset |
| `APP_URL` | Public application URL used by auth flows |

Authentication endpoints include `/api/v1/users/email-verification/request`, `/api/v1/users/email-verification/verify`, `/api/v1/users/password-reset/request`, `/api/v1/users/password-reset/confirm`, and `/api/v1/users/logout-all`. Refresh tokens are rotated into server-side sessions and can be revoked.
| `ADMIN_PASSWORD` | Temporary-dashboard sign-in password |
| `LOG_LEVEL` | Pino log level |

When `REDIS_URL` is configured, BullMQ runs an outbox worker inside the backend process. Authentication emails and Elasticsearch indexing are first persisted in MongoDB as outbox events, then processed with exponential retries. If Redis is unavailable, the email/search operation uses a synchronous fallback so local development still works.

Never commit `.env` files or demo/admin passwords.

## Observability profile

Start the optional observability stack with:

```powershell
docker compose --profile observability up -d
```

Prometheus is available at `http://localhost:9090`, Grafana at `http://localhost:3001`, and Loki at `http://localhost:3100`. Before scraping, replace the placeholder token in `deploy/observability/prometheus.yml` with the backend `METRICS_TOKEN`. Promtail forwards Docker container logs to Loki. The backend still exposes the lightweight protected admin metrics/log view separately.

## Testing

```powershell
cd TribetalkBackend
npm test
npx playwright install chromium
npm run test:e2e
```

The Playwright suite expects the Docker app at `http://localhost:8080`; set `PLAYWRIGHT_BASE_URL` to target another environment. GitHub Actions installs dependencies, runs backend tests, builds the frontend, starts Docker Compose, and runs browser smoke tests.

## Deployment

The repository includes Docker and Nginx configuration for a single-host deployment. For HTTPS, point a domain at the host, obtain a Let's Encrypt certificate, set `PUBLIC_ORIGIN`, `COOKIE_SECURE=true`, and `DOMAIN`, then run:

```powershell
docker compose -f docker-compose.yml -f docker-compose.production.yml up --build -d
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for details.

For the Vercel-frontend plus friend-laptop backend/observability demo, see the
**Friend-laptop backend and observability demo** section in [DEPLOYMENT.md](DEPLOYMENT.md).

