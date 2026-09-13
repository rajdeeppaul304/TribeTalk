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

MongoDB data persists in the `mongo-data` Docker volume. To remove it intentionally, run `docker compose down -v`.

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
