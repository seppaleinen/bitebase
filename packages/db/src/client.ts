import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

// Pin the pool to globalThis so Next.js hot reloads don't spawn new pools.
// Each pool instance holds up to `max` connections; without this the dev server
// leaks a new pool on every module reload and quickly exhausts Postgres's limit.
declare global {
  // eslint-disable-next-line no-var
  var __bitebase_db: DrizzleDB | undefined;
  // eslint-disable-next-line no-var
  var __bitebase_pg: postgres.Sql | undefined;
}

export function getDb(): DrizzleDB {
  if (globalThis.__bitebase_db) return globalThis.__bitebase_db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  // Keep the pool small so multiple workers don't exceed Postgres's limit.
  // Default Postgres max_connections = 100; leave headroom for other services.
  const client = postgres(connectionString, { max: 5, idle_timeout: 20, connect_timeout: 10 });
  globalThis.__bitebase_pg = client;
  globalThis.__bitebase_db = drizzle(client, { schema });
  return globalThis.__bitebase_db;
}

// Lazy proxy — safe to import at module level, connection established on first use
export const db = new Proxy({} as DrizzleDB, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type Database = DrizzleDB;
