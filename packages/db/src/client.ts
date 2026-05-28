import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

let _db: DrizzleDB | undefined;

export function getDb(): DrizzleDB {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const client = postgres(connectionString, { max: 10 });
  _db = drizzle(client, { schema });
  return _db;
}

// Lazy proxy — safe to import at module level, connection established on first use
export const db = new Proxy({} as DrizzleDB, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type Database = DrizzleDB;
