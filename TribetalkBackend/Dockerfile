FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 3000

CMD ["node", "-r", "dotenv/config", "src/index.js"]
