import pino from "pino";

const MAX_RECENT_LOGS = 250;
const recentLogs = [];

const recordLog = (args) => {
  const data = args.find((value) => value && typeof value === "object" && !(value instanceof Error)) || {};
  const message = args.find((value) => typeof value === "string") || data.msg || "Log event";
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level: data.level || "info",
    message,
    requestId: data.req?.id || data.requestId || null,
    method: data.req?.method || null,
    url: data.req?.url || null,
    statusCode: data.res?.statusCode || data.statusCode || null,
    responseTime: data.responseTime || null,
    socketId: data.socketId || null,
    userId: data.userId?.toString?.() || null,
    error: data.err?.message || data.error?.message || null,
  };
  recentLogs.unshift(entry);
  if (recentLogs.length > MAX_RECENT_LOGS) recentLogs.length = MAX_RECENT_LOGS;
};

export const getRecentLogs = (limit = 100) => recentLogs.slice(0, Math.min(Math.max(Number(limit) || 100, 1), MAX_RECENT_LOGS));

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: undefined,
  redact: ["req.headers.authorization", "req.headers.cookie", "accessToken", "refreshToken", "password"],
  hooks: { logMethod(args, method) { recordLog(args); return method.apply(this, args); } },
});
