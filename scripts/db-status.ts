/**
 * Read-only: has this database applied every migration in the repository?
 * Production applies the whole journal on every deploy, so "up to date" means
 * "same schema as production".
 *
 *   pnpm db:status
 */
import { config } from "dotenv";

import { db } from "@/server/db";
import { migrationRefusal, migrationStatus } from "@/server/db/migration-status";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const status = await migrationStatus(db());
  const refusal = migrationRefusal(status);
  if (refusal) {
    console.error(refusal);
    process.exit(1);
  }
  console.info(
    `Güncel: ${status.applied}/${status.expected} migration uygulanmış (canlıyla aynı şema).`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "db:status failed");
  process.exit(1);
});
