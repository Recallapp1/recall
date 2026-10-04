/**
 * Docker-free local Postgres: `pnpm db:local`.
 * Serves PGlite over the Postgres wire protocol on the same port as the
 * docker compose service, with data persisted in `.pglite/`. Development only.
 */
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const PORT = 5433;

async function main() {
  const db = await PGlite.create({ dataDir: "./.pglite", extensions: { btree_gist } });
  const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 20 });
  await server.start();
  console.info(`Local Postgres (PGlite) on postgres://localhost:${PORT} — data in .pglite/`);

  const shutdown = async () => {
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
