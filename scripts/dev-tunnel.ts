/**
 * Local voice testing: opens a Cloudflare quick tunnel to `pnpm dev`, writes
 * its URL to APP_URL in .env.local and points every existing Retell agent at
 * it. Quick tunnels get a new hostname on every start, and an agent left on a
 * dead hostname makes the assistant fail every tool call ("bağlantı sorunu").
 *
 *   pnpm dev            # first terminal
 *   pnpm dev:tunnel     # second terminal; keep it open (Ctrl+C closes the tunnel)
 *
 * Only clinics that already have an agent are synced; creating agents stays
 * with the console or `pnpm voice:sync`.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { config } from "dotenv";

import { db } from "@/server/db";
import { migrationRefusal, migrationStatus } from "@/server/db/migration-status";
import { clinics, voiceAgents } from "@/server/db/schema";
import { retellClient, retellConfig } from "@/server/voice/providers/retell/config";
import { syncClinicVoiceAgent } from "@/server/voice/providers/retell/sync";
import { isAppUrlReachable } from "@/server/voice/providers/retell/test-call";
import { eq } from "drizzle-orm";

config({ path: [".env.local", ".env"], quiet: true });

const ENV_FILE = ".env.local";
const LOCAL_ORIGIN = "http://localhost:3000";
const WINDOWS_DEFAULT = "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe";
const URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const READY_TIMEOUT_MS = 90_000;

function cloudflaredBinary(): string {
  return process.platform === "win32" && existsSync(WINDOWS_DEFAULT)
    ? WINDOWS_DEFAULT
    : "cloudflared";
}

function writeAppUrl(url: string) {
  const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const next = /^APP_URL=.*$/m.test(current)
    ? current.replace(/^APP_URL=.*$/m, `APP_URL=${url}`)
    : `${current.trimEnd()}\nAPP_URL=${url}\n`;
  writeFileSync(ENV_FILE, next);
}

async function waitUntilReachable(url: string): Promise<boolean> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isAppUrlReachable(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return false;
}

async function syncAgents(appUrl: string) {
  const settings = retellConfig();
  const targets = await db()
    .select({ id: clinics.id, slug: clinics.slug })
    .from(voiceAgents)
    .innerJoin(clinics, eq(clinics.id, voiceAgents.clinicId));
  for (const target of targets) {
    const result = await syncClinicVoiceAgent(db(), target.id, {
      api: retellClient(),
      config: {
        appUrl,
        llmModel: settings.llmModel,
        defaultVoiceId: settings.defaultVoiceId,
        voiceModel: settings.voiceModel,
        llmHighPriority: settings.llmHighPriority,
        tuning: settings.tuning,
      },
    });
    console.info(
      result.status === "error"
        ? `✗ ${target.slug}: ${result.error}`
        : `✓ ${target.slug}: ajan ${result.status}`,
    );
  }
}

async function main() {
  // A dev database behind production fails every call event (2026-10-17).
  const refusal = migrationRefusal(await migrationStatus(db()));
  if (refusal) {
    console.error(refusal);
    process.exit(1);
  }
  if (
    !(await fetch(LOCAL_ORIGIN).then(
      () => true,
      () => false,
    ))
  ) {
    console.error(
      `${LOCAL_ORIGIN} yanıt vermiyor. Önce başka bir terminalde \`pnpm dev\` çalıştırın.`,
    );
    process.exit(1);
  }

  const tunnel = spawn(cloudflaredBinary(), ["tunnel", "--no-autoupdate", "--url", LOCAL_ORIGIN], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  tunnel.on("error", (error) => {
    console.error(
      `cloudflared başlatılamadı (${error.message}). Kurulum: docs/02-voice-agent/RETELL-SETUP.md`,
    );
    process.exit(1);
  });
  tunnel.on("exit", (code) => {
    console.error(`Tünel kapandı (kod ${code}). Asistan araçları yeniden açılana kadar çalışmaz.`);
    process.exit(code ?? 1);
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => tunnel.kill());
  }

  const url = await new Promise<string>((resolve) => {
    // cloudflared logs to stderr; the hostname appears once the tunnel is registered.
    const onData = (chunk: Buffer) => {
      const match = URL_PATTERN.exec(chunk.toString());
      if (match) resolve(match[0]);
    };
    tunnel.stderr.on("data", onData);
    tunnel.stdout.on("data", onData);
  });
  console.info(`Tünel: ${url}`);

  if (!(await waitUntilReachable(url))) {
    console.error(
      "Tünel adresine ulaşılamadı (DNS veya dev sunucusu). Ctrl+C ile kapatıp tekrar deneyin.",
    );
    return;
  }
  writeAppUrl(url);
  console.info(`${ENV_FILE}: APP_URL güncellendi (dev sunucusu kendiliğinden yeniden okur).`);
  await syncAgents(url);
  console.info(
    "Hazır. Test araması: http://localhost:3000/panel/ayarlar/asistan · Kapatmak için Ctrl+C",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
