/**
 * Closing a clinic (full audit A16, docs/06-operations/CLINIC-OFFBOARDING.md).
 *
 *   pnpm clinic:offboard --clinic <slug> --step export
 *   pnpm clinic:offboard --clinic <slug> --step erase --yes
 *   pnpm clinic:offboard --clinic <slug> --step purge --yes
 *
 * export writes the clinic's data to outputs/offboard-<slug>-<time>.json (git
 * ignored) for handing to the clinic; erase deletes personal data and queues
 * the provider deletions; purge deletes the clinic once the provider has
 * confirmed them. Prints counts only, never data.
 *
 * Dev database only until the procedure has been rehearsed and approved for
 * production: refuses any other DATABASE_URL.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { config } from "dotenv";
import { eq } from "drizzle-orm";

import { devDatabaseRefusal } from "@/lib/dev-database";
import { db } from "@/server/db";
import { clinics } from "@/server/db/schema";
import { eraseClinicData, exportClinicData, purgeClinic } from "@/server/domain/offboarding";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const refusal = devDatabaseRefusal(process.env.DATABASE_URL);
  if (refusal) {
    console.error(`Refusing to offboard: ${refusal}`);
    process.exit(1);
  }
  const { values } = parseArgs({
    options: {
      clinic: { type: "string" },
      step: { type: "string" },
      yes: { type: "boolean", default: false },
    },
  });
  const step = values.step;
  if (!values.clinic || !["export", "erase", "purge"].includes(step ?? "")) {
    console.error("Usage: pnpm clinic:offboard --clinic <slug> --step export|erase|purge [--yes]");
    process.exit(1);
  }
  if (step !== "export" && !values.yes) {
    console.error(`"${step}" cannot be undone; run export first and add --yes.`);
    process.exit(1);
  }
  const [clinic] = await db().select().from(clinics).where(eq(clinics.slug, values.clinic));
  if (!clinic) {
    console.error("Clinic not found.");
    process.exit(1);
  }

  const now = new Date();
  if (step === "export") {
    const data = await exportClinicData(db(), clinic.id);
    mkdirSync("outputs", { recursive: true });
    const file = join(
      "outputs",
      `offboard-${clinic.slug}-${now.toISOString().replace(/[:.]/g, "-")}.json`,
    );
    writeFileSync(file, JSON.stringify(data, null, 2));
    for (const [name, rows] of Object.entries(data)) {
      if (Array.isArray(rows)) console.info(`${name.padEnd(18)} ${rows.length}`);
    }
    console.info(`→ ${file} (data not printed)`);
  } else if (step === "erase") {
    console.info(await eraseClinicData(db(), clinic.id, now));
    console.info("Provider deletions run with the daily job; purge once they are confirmed.");
  } else {
    console.info(await purgeClinic(db(), clinic.id, now));
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "offboarding failed");
  if (error instanceof Error && error.cause instanceof Error)
    console.error(`cause: ${error.cause.name} ${(error.cause as { code?: string }).code ?? ""}`);
  process.exit(1);
});
