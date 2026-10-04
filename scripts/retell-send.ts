/**
 * Sends a fixture to a local Retell endpoint, signed exactly like Retell does.
 * Lets you exercise the webhooks without a phone call.
 *
 *   pnpm voice:send inbound
 *   pnpm voice:send function-call --agent <retell agent id>
 *   pnpm voice:send call-ended --agent <retell agent id>
 *
 * `--agent` defaults to the agent synced for the demo clinic.
 */
import { readFileSync } from "node:fs";

import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { sign } from "retell-sdk";

import { db } from "@/server/db";
import { clinics, voiceAgents } from "@/server/db/schema";
import { retellConfig } from "@/server/voice/providers/retell/config";

config({ path: [".env.local", ".env"], quiet: true });

const ROUTES: Record<string, string> = {
  inbound: "/api/voice/retell/inbound",
  "function-call": "/api/voice/retell/tools",
  "call-ended": "/api/voice/retell/events",
};

async function demoAgentId() {
  const [row] = await db()
    .select({ agentId: voiceAgents.externalAgentId })
    .from(voiceAgents)
    .innerJoin(clinics, eq(clinics.id, voiceAgents.clinicId))
    .where(eq(clinics.slug, "gulus-dis"));
  return row?.agentId ?? undefined;
}

async function main() {
  const fixture = process.argv[2];
  const route = fixture ? ROUTES[fixture] : undefined;
  if (!fixture || !route) {
    console.error(`Usage: pnpm voice:send <${Object.keys(ROUTES).join("|")}> [--agent <id>]`);
    process.exit(2);
  }
  const agentIndex = process.argv.indexOf("--agent");
  const agentId = agentIndex > -1 ? process.argv[agentIndex + 1] : await demoAgentId();

  const raw = readFileSync(`scripts/fixtures/retell-${fixture}.json`, "utf8");
  if (raw.includes("__AGENT_ID__") && !agentId) {
    console.error("No agent id: run `pnpm voice:sync --clinic gulus-dis` first or pass --agent.");
    process.exit(1);
  }
  const body = JSON.stringify(JSON.parse(raw.replaceAll("__AGENT_ID__", agentId ?? "")));

  // Always local: the tunnel URL in APP_URL would add a needless round trip.
  const url = new URL(route, "http://localhost:3000");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-retell-signature": await sign(body, retellConfig().apiKey),
    },
    body,
  });
  console.info(`${response.status} ${url.pathname}`);
  console.info(JSON.stringify(await response.json(), null, 2));
  process.exit(response.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
