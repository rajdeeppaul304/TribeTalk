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

4. Put HTTPS in front of port 8080 (for example, a cloud load balancer, Caddy, or a host-level Nginx configuration). Cookies are configured for same-origin browser access through the included Nginx proxy.
5. Use a managed MongoDB service or add backups before treating the deployment as production.

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

## API safeguards

- Helmet adds browser-facing security headers.
- All API traffic is rate-limited; login, registration, and token refresh have a stricter limit.
- Zod validates public request bodies, route parameters, and message-history query parameters before controller code runs.
- Run backend tests with `npm test` from `TribetalkBackend`.

## Redis

Docker starts Redis automatically. It provides shared request-rate counters, shared Socket.IO event delivery when multiple backend containers are running, and short-lived presence keys for active sockets. The health endpoint reports the Redis connection state.

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
