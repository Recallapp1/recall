import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/env";

import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Anything that can run queries: the root client or an open transaction. */
export type Executor = Database | Transaction;

const globalForDb = globalThis as unknown as { recallDb?: Database };

function createDb(): Database {
  const config = env();
  const pool = new Pool({ connectionString: config.DATABASE_URL, max: config.DATABASE_POOL_MAX });
  // Lets Vercel Fluid Compute close idle connections before an instance is suspended.
  attachDatabasePool(pool);
  return drizzle({ client: pool, schema, casing: "snake_case" });
}

/** Lazily created singleton; reused across hot reloads in development. */
export function db(): Database {
  globalForDb.recallDb ??= createDb();
  return globalForDb.recallDb;
}

export { schema };
