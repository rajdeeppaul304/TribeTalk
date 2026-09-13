const startedAt = Date.now();
const counters = { httpRequests: 0, httpErrors: 0, socketConnections: 0, activeSockets: 0, messagesSent: 0, socketEventErrors: 0 };

export const metrics = {
  increment(name) { if (Object.hasOwn(counters, name)) counters[name] += 1; },
  decrement(name) { if (Object.hasOwn(counters, name)) counters[name] = Math.max(0, counters[name] - 1); },
  snapshot() { return { ...counters, uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) }; },
};
