import { Registry, Counter, Histogram, Gauge } from "prom-client";

// Create a registry for metrics
export const register = new Registry();

// HTTP request metrics
export const httpRequestDurationMicroseconds = new Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["operation", "status_code"],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
});

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["operation", "status_code"],
});

// tRPC procedure metrics
export const trpcProcedureDuration = new Histogram({
  name: "trpc_procedure_duration_ms",
  help: "Duration of tRPC procedure execution in ms",
  labelNames: ["procedure", "status"],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
});

export const trpcProcedureCalls = new Counter({
  name: "trpc_procedure_calls_total",
  help: "Total number of tRPC procedure calls",
  labelNames: ["procedure", "status"],
});

// Database metrics
export const dbQueryDuration = new Histogram({
  name: "db_query_duration_ms",
  help: "Duration of database queries in ms",
  labelNames: ["operation", "table"],
  buckets: [1, 5, 10, 50, 100, 500, 1000, 5000],
});

export const dbQueryTotal = new Counter({
  name: "db_query_total",
  help: "Total number of database queries",
  labelNames: ["operation", "table"],
});

// System metrics
export const activeConnections = new Gauge({
  name: "active_connections",
  help: "Number of active connections",
});

export const memoryUsage = new Gauge({
  name: "memory_usage_bytes",
  help: "Memory usage in bytes",
  labelNames: ["type"],
});

// Register all metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestsTotal);
register.registerMetric(trpcProcedureDuration);
register.registerMetric(trpcProcedureCalls);
register.registerMetric(dbQueryDuration);
register.registerMetric(dbQueryTotal);
register.registerMetric(activeConnections);
register.registerMetric(memoryUsage);

// Helper to record HTTP request duration
export function recordHttpRequest(operation: string, statusCode: number, durationMs: number) {
  const status = statusCode.toString();
  httpRequestDurationMicroseconds.observe({ operation, status_code: status }, durationMs);
  httpRequestsTotal.inc({ operation, status_code: status });
}

// Helper to record tRPC procedure
export function recordTrpcProcedure(procedure: string, status: string, durationMs: number) {
  trpcProcedureDuration.observe({ procedure, status }, durationMs);
  trpcProcedureCalls.inc({ procedure, status });
}

// Helper to record database query
export function recordDbQuery(operation: string, table: string, durationMs: number) {
  dbQueryDuration.observe({ operation, table }, durationMs);
  dbQueryTotal.inc({ operation, table });
}

// Update system metrics periodically
export function updateSystemMetrics() {
  const memUsage = process.memoryUsage();
  memoryUsage.set({ type: "rss" }, memUsage.rss);
  memoryUsage.set({ type: "heapTotal" }, memUsage.heapTotal);
  memoryUsage.set({ type: "heapUsed" }, memUsage.heapUsed);
  memoryUsage.set({ type: "external" }, memUsage.external);
}

// Update system metrics every 5 seconds
setInterval(updateSystemMetrics, 5000);