import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client"

const startedAt = Date.now()
const counters = { httpRequests: 0, httpErrors: 0, socketConnections: 0, activeSockets: 0, messagesSent: 0, socketEventErrors: 0 }
const registry = new Registry()
collectDefaultMetrics({ register: registry, prefix: "tribetalk_" })

const httpRequests = new Counter({ name: "tribetalk_http_requests_total", help: "Total HTTP requests", registers: [registry] })
const httpErrors = new Counter({ name: "tribetalk_http_errors_total", help: "Total HTTP responses with status >= 400", registers: [registry] })
const socketConnections = new Counter({ name: "tribetalk_socket_connections_total", help: "Total socket connections", registers: [registry] })
const messagesSent = new Counter({ name: "tribetalk_messages_sent_total", help: "Total channel messages accepted", registers: [registry] })
const socketEventErrors = new Counter({ name: "tribetalk_socket_event_errors_total", help: "Total socket event validation/processing errors", registers: [registry] })
const activeSockets = new Gauge({ name: "tribetalk_active_sockets", help: "Currently connected sockets", registers: [registry] })
const httpDuration = new Histogram({ name: "tribetalk_http_request_duration_seconds", help: "HTTP request duration in seconds", buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5], registers: [registry] })
const dependencyRequests = new Counter({ name: "tribetalk_dependency_requests_total", help: "Dependency operations by dependency, operation, and outcome", labelNames: ["dependency", "operation", "status"], registers: [registry] })
const dependencyErrors = new Counter({ name: "tribetalk_dependency_errors_total", help: "Failed dependency operations", labelNames: ["dependency", "operation"], registers: [registry] })
const dependencyDuration = new Histogram({ name: "tribetalk_dependency_duration_seconds", help: "Dependency operation duration in seconds", labelNames: ["dependency", "operation"], buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5], registers: [registry] })
const mongodbPoolCheckedOut = new Gauge({ name: "tribetalk_mongodb_connection_pool_checked_out", help: "MongoDB connections currently checked out by the driver", registers: [registry] })
const mongodbPoolSize = new Gauge({ name: "tribetalk_mongodb_connection_pool_size", help: "MongoDB connections currently created in the pool", registers: [registry] })

const counterMap = { httpRequests, httpErrors, socketConnections, messagesSent, socketEventErrors }

export const metrics = {
  increment(name) {
    if (!Object.hasOwn(counters, name)) return
    counters[name] += 1
    if (name === "activeSockets") activeSockets.inc()
    else counterMap[name]?.inc()
  },
  decrement(name) {
    if (!Object.hasOwn(counters, name)) return
    counters[name] = Math.max(0, counters[name] - 1)
    if (name === "activeSockets") activeSockets.dec()
  },
  observeHttp(durationMs, statusCode) {
    httpDuration.observe(durationMs / 1000)
    if (statusCode >= 400) metrics.increment("httpErrors")
  },
  observeDependency(dependency, operation, durationMs, status = "success") {
    const labels = { dependency, operation }
    dependencyRequests.inc({ ...labels, status })
    dependencyDuration.observe(labels, durationMs / 1000)
    if (status === "error") dependencyErrors.inc(labels)
  },
  setMongoPoolCheckedOut(value) { mongodbPoolCheckedOut.set(Math.max(0, value)) },
  setMongoPoolSize(value) { mongodbPoolSize.set(Math.max(0, value)) },
  snapshot() { return { ...counters, uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) } },
  async prometheus() { return registry.metrics() },
}

export const trackDependency = async (dependency, operation, work) => {
  const startedAt = process.hrtime.bigint()
  try {
    const result = await work()
    metrics.observeDependency(dependency, operation, Number(process.hrtime.bigint() - startedAt) / 1_000_000, "success")
    return result
  } catch (error) {
    metrics.observeDependency(dependency, operation, Number(process.hrtime.bigint() - startedAt) / 1_000_000, "error")
    throw error
  }
}

