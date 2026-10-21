FROM node:22-bookworm-slim

WORKDIR /app

COPY TribetalkBackend/package.json TribetalkBackend/package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node TribetalkBackend/src ./src
COPY --chown=node:node shared /shared

USER node

EXPOSE 3000

CMD ["node", "-r", "dotenv/config", "src/index.js"]
