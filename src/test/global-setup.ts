import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    /** Path of a migrated PGlite data directory (tarball) every test file starts from. */
    pgliteSnapshot: string;
  }
}

/**
 * Applies the migrations once per run instead of once per test file. Every
 * file used to migrate its own database in parallel; as migrations grew,
 * setup hooks started timing out under load (accounts.test.ts, 2026-10-06).
 */
export default async function setup(project: TestProject) {
  const client = new PGlite({ extensions: { btree_gist } });
  await migrate(drizzle({ client, casing: "snake_case" }), { migrationsFolder: "./drizzle" });
  const snapshot = await client.dumpDataDir("none");
  await client.close();

  const dir = mkdtempSync(join(tmpdir(), "recall-test-db-"));
  const path = join(dir, "migrated.tar");
  writeFileSync(path, Buffer.from(await snapshot.arrayBuffer()));
  project.provide("pgliteSnapshot", path);

  return () => rmSync(dir, { recursive: true, force: true });
}
