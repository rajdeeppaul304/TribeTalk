import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: undefined,
  redact: ["req.headers.authorization", "req.headers.cookie", "accessToken", "refreshToken", "password"],
});
