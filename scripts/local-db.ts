/**
 * Docker-free local Postgres: `pnpm db:local`.
 * Serves PGlite over the Postgres wire protocol on the same port as the
 * docker compose service, with data persisted in `.pglite/`. Development only.
 *
 * PGlite's data directory can be left unreadable when the process is killed
 * mid-write (seen twice; WASM "Aborted()"). A snapshot is written every few
 * minutes and restored automatically if the directory no longer opens.
 * Concurrent connections destabilise the socket server: keep
 * DATABASE_POOL_MAX=1 and avoid running scripts while the app is busy.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const PORT = 5433;
const DATA_DIR = "./.pglite";
const SNAPSHOT = "./.pglite-snapshot.tar.gz";
const SNAPSHOT_EVERY_MS = 5 * 60_000;

async function open(): Promise<PGlite> {
  try {
    return await PGlite.create({ dataDir: DATA_DIR, extensions: { btree_gist } });
  } catch (error) {
    if (!existsSync(SNAPSHOT)) throw error;
    const aside = `${DATA_DIR}.corrupt-${Date.now()}`;
    console.warn(`Data directory did not open; moved to ${aside}, restoring ${SNAPSHOT}`);
    renameSync(DATA_DIR, aside);
    return PGlite.create({
      dataDir: DATA_DIR,
      extensions: { btree_gist },
      loadDataDir: new Blob([readFileSync(SNAPSHOT)]),
    });
  }
}

async function snapshot(db: PGlite) {
  try {
    const dump = await db.dumpDataDir("gzip");
    const temporary = `${SNAPSHOT}.tmp`;
    writeFileSync(temporary, Buffer.from(await dump.arrayBuffer()));
    renameSync(temporary, SNAPSHOT);
  } catch (error) {
    console.error("Snapshot failed:", error instanceof Error ? error.message : error);
  }
}

async function main() {
  const db = await open();
  const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 4 });
  await server.start();
  console.info(`Local Postgres (PGlite) on postgres://localhost:${PORT} — data in .pglite/`);

  await snapshot(db);
  const timer = setInterval(() => void snapshot(db), SNAPSHOT_EVERY_MS);

  const shutdown = async () => {
    clearInterval(timer);
    await snapshot(db);
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
