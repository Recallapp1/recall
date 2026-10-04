/**
 * Creates or updates clinics' Retell agents from our database.
 *
 *   pnpm voice:sync --clinic <slug> [--force]
 *   pnpm voice:sync --all [--force]
 *
 * Runs with the `react-server` condition so server-only modules can load.
 */
import { config } from "dotenv";

import { db } from "@/server/db";
import { clinics } from "@/server/db/schema";
import { findClinicBySlug } from "@/server/domain/clinics";
import { retellClient, retellConfig } from "@/server/voice/providers/retell/config";
import { syncClinicVoiceAgent } from "@/server/voice/providers/retell/sync";

config({ path: [".env.local", ".env"], quiet: true });

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : undefined;
}

async function main() {
  const slug = argValue("--clinic");
  const all = process.argv.includes("--all");
  const force = process.argv.includes("--force");
  if (!slug && !all) {
    console.error("Usage: pnpm voice:sync --clinic <slug> | --all [--force]");
    process.exit(2);
  }

  const settings = retellConfig();
  const targets = all
    ? await db().select({ id: clinics.id, slug: clinics.slug }).from(clinics)
    : await findClinicBySlug(db(), slug!).then((ctx) =>
        ctx ? [{ id: ctx.clinic.id, slug: ctx.clinic.slug }] : [],
      );
  if (targets.length === 0) {
    console.error(`No clinic found${slug ? ` with slug "${slug}"` : ""}.`);
    process.exit(1);
  }

  let failed = 0;
  for (const target of targets) {
    const result = await syncClinicVoiceAgent(db(), target.id, {
      api: retellClient(),
      config: {
        appUrl: settings.appUrl,
        llmModel: settings.llmModel,
        defaultVoiceId: settings.defaultVoiceId,
      },
      force,
    });
    if (result.status === "error") {
      failed += 1;
      console.error(`✗ ${target.slug}: ${result.error}`);
    } else {
      console.info(
        `✓ ${target.slug}: ${result.status} · agent ${result.agentId} (v${result.version ?? "?"})`,
      );
      console.info(`  https://dashboard.retellai.com/agents/${result.agentId}`);
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
