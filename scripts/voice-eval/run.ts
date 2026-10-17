/**
 * Voice evaluation runner (docs/02-voice-agent/VOICE-EVAL.md).
 *
 *   pnpm dev            # local app on the dev database
 *   pnpm dev:tunnel     # public URL for Retell, dev agent re-pointed
 *   pnpm voice:eval [--only id1,id2] [--profile <id> | --profiles a,b | --stage 1] [--budget 12]
 *   pnpm voice:eval --plan     # profiles, stages and estimated cost, no calls
 *
 * A run stops cleanly before the budget (default: the estimate + 20%) would
 * be exceeded, when Retell reports no credit, or on Ctrl+C; the dev assistant
 * is always switched back to the env configuration.
 *
 * Every scenario is a real Retell web call with the dev clinic's assistant:
 * the caller's lines are spoken by Windows TTS (tts.ps1) and fed to Playwright's
 * Chromium as its microphone. Checks read the call's tool calls and transcript
 * from Retell and the appointments from the dev database. Refuses to run
 * against production. `--profile` re-syncs the dev agent with another model or
 * latency setting for the run and restores the env configuration afterwards
 * (profiles.ts).
 */
import { devDatabaseRefusal } from "@/lib/dev-database";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import { join, resolve } from "node:path";

import { chromium } from "@playwright/test";
import { config } from "dotenv";
import { and, eq, gte, inArray, like } from "drizzle-orm";
import Retell from "retell-sdk";

import { normalizePhone } from "@/lib/phone";
import { db } from "@/server/db";
import {
  appointments,
  clinics,
  patients,
  practitioners,
  rateLimits,
  services,
  voiceAgents,
} from "@/server/db/schema";
import { bookAppointment } from "@/server/domain/appointments";
import { findClinicBySlug } from "@/server/domain/clinics";
import { findAvailability } from "@/server/domain/scheduling";
import { spokenDate } from "@/server/domain/speech";
import { addLocalDays, localToday, utcToLocal } from "@/server/domain/time";
import { retellClient, retellConfig } from "@/server/voice/providers/retell/config";
import { syncClinicVoiceAgent } from "@/server/voice/providers/retell/sync";

import { budgetAllows, cautiousCallEstimate, isCreditExhausted } from "./budget";
import { estimatedCost, profiles, STAGES, type EvalProfile } from "./profiles";
import { invariants, scenarios, type CallOutcome, type Scenario, type ToolCall } from "./scenarios";

config({ path: [".env.local", ".env"], quiet: true });

const CLINIC_SLUG = "gulus-dis";
const WORK_DIR = resolve(".voice-eval");
const SEEDED = { zeynep: "+905329000051", murat: "+905329000052" } as const;

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY ?? "" });

function guard() {
  const appUrl = process.env.APP_URL ?? "";
  if (!process.env.RETELL_API_KEY) throw new Error("RETELL_API_KEY is not set.");
  const refusal = devDatabaseRefusal(process.env.DATABASE_URL);
  if (refusal) throw new Error(`Refusing to run: ${refusal} Use the dev database and tunnel.`);
  if (appUrl.includes("recalltr.company")) {
    throw new Error("Refusing to run: APP_URL is production. Use the dev tunnel.");
  }
  if (process.platform !== "win32") {
    throw new Error("Caller audio uses Windows text-to-speech (tts.ps1); run on Windows.");
  }
}

/** Removes the evaluation's own patients and seeds the two appointments the change scenarios use. */
async function resetData(clinicId: string) {
  const ctx = await findClinicBySlug(db(), CLINIC_SLUG);
  if (!ctx) throw new Error(`Clinic ${CLINIC_SLUG} not found (pnpm db:seed).`);
  await db()
    .delete(patients)
    .where(and(eq(patients.clinicId, clinicId), like(patients.phone, "+905329000%")));
  await db().delete(rateLimits).where(like(rateLimits.key, "voice-verify:%"));

  const [service] = await db()
    .select()
    .from(services)
    .where(and(eq(services.clinicId, clinicId), eq(services.name, "Muayene / Kontrol")));
  // Next week's Tuesday, 10:00 local.
  const today = localToday(new Date(), ctx.clinic.timezone);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  // "Haftaya Salı": the first Tuesday after today.
  const tuesday = addLocalDays(today, (2 - weekday + 7) % 7 || 7);
  const seeded: Record<string, string> = {};
  const plan = [
    { key: "zeynep", name: "Zeynep Aksoy", phone: SEEDED.zeynep, time: "10:00" },
    { key: "murat", name: "Murat Kaya", phone: SEEDED.murat, time: "11:00" },
  ];
  for (const entry of plan) {
    // Whoever works that morning (practitioners keep their own schedules).
    let booked: string | null = null;
    for (const practitionerId of await practitionerIds(clinicId)) {
      const slots = await findAvailability(db(), ctx, {
        serviceId: service!.id,
        practitionerId,
        date: tuesday,
        now: new Date(),
      });
      if (!slots.slots.some((slot) => slot.time === entry.time)) continue;
      const { appointment } = await bookAppointment(db(), ctx, {
        serviceId: service!.id,
        practitionerId,
        date: tuesday,
        time: entry.time,
        patientName: entry.name,
        patientPhone: entry.phone,
        source: "panel",
        now: new Date(),
      });
      booked = appointment.id;
      break;
    }
    if (!booked) throw new Error(`No practitioner free on ${tuesday} at ${entry.time}.`);
    seeded[entry.key] = booked;
  }
  return seeded;
}

async function practitionerIds(clinicId: string): Promise<string[]> {
  const rows = await db()
    .select({ id: practitioners.id })
    .from(practitioners)
    .where(and(eq(practitioners.clinicId, clinicId), eq(practitioners.isActive, true)));
  return rows.map((row) => row.id);
}

/**
 * Fills date tokens with spoken dates from today: {tomorrow}, and {nextMon} …
 * {nextSun} for the first such weekday after today (e.g. "on dört Ekim Çarşamba").
 */
function expandLines(lines: string[]): string[] {
  const today = localToday(new Date(), "Europe/Istanbul");
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const tokens: Record<string, string> = { tomorrow: spokenDate(addLocalDays(today, 1)) };
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((name, day) => {
    tokens[`next${name}`] = spokenDate(addLocalDays(today, (day - weekday + 7) % 7 || 7));
  });
  return lines.map((line) =>
    line.replace(/\{(\w+)\}/g, (match, key: string) => tokens[key] ?? match),
  );
}

/** Silences inside a turn and the caller's pace, as SSML for tts.ps1. */
function speechMarkup(line: string, pace: Scenario["pace"]): string {
  const marked = line
    .replaceAll("{pause}", '<break time="1500ms"/>')
    .replaceAll("{longPause}", '<break time="2500ms"/>');
  return pace === "slow" ? `<prosody rate="slow">${marked}</prosody>` : marked;
}

/** Caller audio for a scenario, cached by its spoken lines. */
function callerAudio(scenario: Scenario): string {
  mkdirSync(WORK_DIR, { recursive: true });
  const spoken = expandLines(scenario.lines).map((line) => speechMarkup(line, scenario.pace));
  const hash = createHash("sha1").update(spoken.join("\n")).digest("hex").slice(0, 12);
  const file = join(WORK_DIR, `${scenario.id}-${hash}.wav`);
  if (!existsSync(file)) {
    const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
    const lines = spoken.map(quote).join(",");
    const result = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `& ${quote(resolve("scripts/voice-eval/tts.ps1"))} -Out ${quote(file)} -Lines @(${lines})`,
      ],
      { encoding: "utf8", shell: false },
    );
    if (result.status !== 0 || !existsSync(file)) {
      throw new Error(`TTS failed for ${scenario.id}: ${result.stderr}`);
    }
  }
  return file;
}

const CALL_PAGE = `<!doctype html><meta charset="utf-8"><title>call</title>
<script type="module">
import { RetellWebClient } from "https://esm.sh/retell-client-js-sdk@3.0.2";
const p = JSON.parse(decodeURIComponent(location.hash.slice(1)));
const web = new RetellWebClient();
web.on("call_ended", () => (document.title = "ended"));
web.on("error", (e) => (document.title = "error " + e));
window.__stop = () => web.stopCall();
web.startCall({ accessToken: p.accessToken, callId: p.callId, transport: p.transport, iceServers: p.iceServers, sampleRate: 16000 })
  .then(() => (document.title = "started"))
  .catch((e) => (document.title = "startfail " + e));
</script>`;

/** Length of a PCM WAV from its header (byte rate at offset 28). */
function wavSeconds(file: string): number {
  const header = readFileSync(file).subarray(0, 44);
  const byteRate = header.readUInt32LE(28) || 32_000;
  return (statSync(file).size - 44) / byteRate;
}

async function runCall(scenario: Scenario, agentId: string, clinicId: string) {
  const audio = callerAudio(scenario);
  const audioSeconds = wavSeconds(audio);
  const call = (await retell.call.createWebCall({
    agent_id: agentId,
    metadata: { clinic_id: clinicId, voice_eval: scenario.id },
    retell_llm_dynamic_variables: {
      caller_number: "",
      transfer_available: "hayır",
      clinic_status: "active",
    },
  })) as unknown as {
    call_id: string;
    access_token: string;
    transport?: string;
    ice_servers?: unknown;
  };

  const server = http
    .createServer((_, res) => {
      res.setHeader("content-type", "text/html");
      res.end(CALL_PAGE);
    })
    .listen(0);
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${audio}%noloop`,
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const startedAt = new Date();
  try {
    const page = await browser.newPage();
    const hash = encodeURIComponent(
      JSON.stringify({
        accessToken: call.access_token,
        callId: call.call_id,
        transport: call.transport,
        iceServers: call.ice_servers,
      }),
    );
    await page.goto(`http://localhost:${port}/#${hash}`);
    const deadline = Date.now() + (audioSeconds + 40) * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const status = ((await retell.call.retrieve(call.call_id)) as { call_status: string })
        .call_status;
      if (status === "ended" || status === "error") break;
    }
    await page.evaluate(() => (window as unknown as { __stop?: () => void }).__stop?.());
  } finally {
    await browser.close();
    server.close();
  }

  // Wait for Retell to finish the call record (transcript, latency, cost).
  let details: Record<string, unknown> = {};
  for (let i = 0; i < 20; i += 1) {
    details = (await retell.call.retrieve(call.call_id)) as unknown as Record<string, unknown>;
    if (details.call_status === "ended" && details.latency) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { callId: call.call_id, startedAt, details };
}

function outcomeOf(
  details: Record<string, unknown>,
): Pick<CallOutcome, "agentText" | "firstReply" | "tools" | "userTurns" | "disconnectionReason"> {
  const turns = (details.transcript_with_tool_calls ?? []) as Array<Record<string, unknown>>;
  const tools: ToolCall[] = [];
  const byId = new Map<string, ToolCall>();
  const agent: string[] = [];
  let userTurns = 0;
  let firstReply = "";
  const parse = (value: unknown) => {
    try {
      return typeof value === "string" ? JSON.parse(value) : (value as Record<string, unknown>);
    } catch {
      return null;
    }
  };
  for (const turn of turns) {
    if (turn.role === "agent") {
      agent.push(String(turn.content ?? ""));
      if (userTurns > 0 && !firstReply) firstReply = String(turn.content ?? "");
    }
    if (turn.role === "user") userTurns += 1;
    if (turn.role === "tool_call_invocation") {
      const tool: ToolCall = {
        name: String(turn.name),
        args: parse(turn.arguments) ?? {},
        result: null,
      };
      tools.push(tool);
      byId.set(String(turn.tool_call_id), tool);
    }
    if (turn.role === "tool_call_result") {
      const tool = byId.get(String(turn.tool_call_id));
      if (tool) tool.result = parse(turn.content);
    }
  }
  return {
    agentText: agent.join(" "),
    firstReply,
    tools,
    userTurns,
    disconnectionReason: String(details.disconnection_reason ?? ""),
  };
}

async function effects(
  scenario: Scenario,
  clinicId: string,
  since: Date,
  seeded: Record<string, string>,
): Promise<Pick<CallOutcome, "newAppointments" | "seeded">> {
  const timezone = "Europe/Istanbul";
  const newAppointments: CallOutcome["newAppointments"] = [];
  const phone = normalizePhone(scenario.phone);
  if (phone) {
    const rows = await db()
      .select({
        startsAt: appointments.startsAt,
        status: appointments.status,
        service: services.name,
      })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          eq(patients.phone, phone),
          gte(appointments.createdAt, since),
          inArray(appointments.status, ["scheduled", "confirmed"]),
        ),
      );
    for (const row of rows) {
      const local = utcToLocal(row.startsAt, timezone);
      newAppointments.push({
        service: row.service,
        date: local.date,
        time: local.time,
        status: row.status,
      });
    }
  }
  const seededState: CallOutcome["seeded"] = {};
  for (const [key, id] of Object.entries(seeded)) {
    const [row] = await db()
      .select({ status: appointments.status, startsAt: appointments.startsAt })
      .from(appointments)
      .where(eq(appointments.id, id));
    const local = row ? utcToLocal(row.startsAt, timezone) : null;
    seededState[key] =
      row && local ? { status: row.status, date: local.date, time: local.time } : null;
  }
  return { newAppointments, seeded: seededState };
}

interface Latency {
  p50?: number;
  p90?: number;
  p95?: number;
  max?: number;
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : undefined;
}

function printPlan(count: number) {
  console.info(`${count} scenarios per run\n`);
  for (const [stage, ids] of Object.entries(STAGES)) {
    const total = ids.reduce(
      (sum, id) =>
        sum +
        estimatedCost(
          profiles.find((p) => p.id === id)!,
          count,
        ),
      0,
    );
    console.info(`stage ${stage}: ${ids.join(" + ")} ≈ $${total.toFixed(2)}`);
  }
  console.info("");
  for (const p of profiles) {
    console.info(`${p.id.padEnd(16)} ${p.title}`);
    console.info(
      `${"".padEnd(16)} model ${p.llmModel} · ${JSON.stringify(p.tuning)} · ` +
        `list $${p.listPricePerMinute.toFixed(4)}/min · run ≈ $${estimatedCost(p, count).toFixed(2)}`,
    );
  }
}

/** Points the dev clinic's agent at a profile's model and tuning, or back at the env settings. */
async function syncDevAgent(clinicId: string, profile: EvalProfile | null) {
  const settings = retellConfig();
  const result = await syncClinicVoiceAgent(db(), clinicId, {
    api: retellClient(),
    config: {
      appUrl: settings.appUrl,
      llmModel: profile?.llmModel ?? settings.llmModel,
      defaultVoiceId: settings.defaultVoiceId,
      voiceModel: settings.voiceModel,
      llmHighPriority: settings.llmHighPriority,
      tuning: profile?.tuning ?? settings.tuning,
    },
    force: true,
  });
  if (result.status === "error") throw new Error(`Agent sync failed: ${result.error}`);
}

async function main() {
  const only = process.argv.includes("--only")
    ? new Set(process.argv[process.argv.indexOf("--only") + 1]!.split(","))
    : null;
  // C5 scenarios need switches in .env.local and have their own commands
  // (voice:eval:c5, voice:eval:c5-close); staged runs and their cost stay as planned.
  const selected = scenarios.filter((s) => (only ? only.has(s.id) : !s.id.startsWith("c5-")));
  if (process.argv.includes("--plan")) {
    printPlan(selected.length);
    process.exit(0);
  }
  const stage = argValue("--stage");
  const ids = stage
    ? STAGES[stage]
    : (argValue("--profiles")?.split(",") ??
      (argValue("--profile") ? [argValue("--profile")!] : []));
  if (stage && !ids) throw new Error(`Unknown stage "${stage}" (pnpm voice:eval --plan).`);
  const chosen = (ids ?? []).map((id) => {
    const found = profiles.find((p) => p.id === id);
    if (!found) throw new Error(`Unknown profile "${id}" (pnpm voice:eval --plan).`);
    return found;
  });
  const estimate = (chosen.length > 0 ? chosen : [profiles[0]!]).reduce(
    (sum, p) => sum + estimatedCost(p, selected.length),
    0,
  );
  const budget = Number(argValue("--budget") ?? (estimate * 1.2).toFixed(2));
  guard();
  const [clinic] = await db().select().from(clinics).where(eq(clinics.slug, CLINIC_SLUG));
  if (!clinic) throw new Error(`Clinic ${CLINIC_SLUG} not found.`);
  const [agent] = await db().select().from(voiceAgents).where(eq(voiceAgents.clinicId, clinic.id));
  if (!agent?.externalAgentId) {
    throw new Error("The dev clinic has no agent (pnpm voice:sync --clinic gulus-dis).");
  }
  const health = await fetch(new URL("/api/health", process.env.APP_URL)).catch(() => null);
  if (!health?.ok) throw new Error("APP_URL is not reachable: start pnpm dev and pnpm dev:tunnel.");

  console.info(`Budget $${budget.toFixed(2)} (estimate $${estimate.toFixed(2)})`);
  let interrupted = false;
  process.on("SIGINT", () => {
    if (interrupted) process.exit(130);
    interrupted = true;
    console.info("\nStopping after the current call; the dev assistant will be switched back.");
  });

  let spent = 0;
  const runs: (EvalProfile | null)[] = chosen.length > 0 ? chosen : [null];
  for (const profile of runs) {
    if (interrupted) break;
    if (profile) {
      await syncDevAgent(clinic.id, profile);
      console.info(`\nProfile ${profile.id}: ${profile.title}`);
    }
    try {
      const outcome = await runScenarios(selected, clinic.id, agent.externalAgentId, profile, {
        budgetLeft: budget - spent,
        perCall: cautiousCallEstimate(estimatedCost(profile ?? profiles[0]!, 1)),
        stopRequested: () => interrupted,
      });
      spent += outcome.spent;
      if (outcome.stopped) {
        console.info(`Stopped cleanly: ${outcome.stopped}.`);
        break;
      }
    } finally {
      // The dev agent goes back to the env configuration whatever happened.
      if (profile) await syncDevAgent(clinic.id, null);
    }
  }
  console.info(`\nTotal spent ≈ $${spent.toFixed(2)} of $${budget.toFixed(2)}`);
  process.exit(0);
}

async function runScenarios(
  selected: Scenario[],
  clinicId: string,
  agentId: string,
  profile: EvalProfile | null | undefined,
  limits: { budgetLeft: number; perCall: number; stopRequested: () => boolean },
): Promise<{ spent: number; stopped: string | null }> {
  let spent = 0;
  let stopped: string | null = null;
  const seeded = await resetData(clinicId);
  const results: Array<Record<string, unknown> & { passed: boolean; costCents: number }> = [];
  mkdirSync(WORK_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(WORK_DIR, `results-${profile?.id ?? "env"}-${stamp}.json`);
  // Saved after every scenario: an interrupted run keeps what it measured.
  const save = () =>
    writeFileSync(
      file,
      JSON.stringify({ agent: agentId, profile: profile ?? "env", results }, null, 2),
    );
  for (const scenario of selected) {
    if (limits.stopRequested()) {
      stopped = "interrupted";
      break;
    }
    if (!budgetAllows(spent, limits.perCall, limits.budgetLeft)) {
      stopped = "budget reached";
      break;
    }
    process.stdout.write(`▶ ${scenario.id} … `);
    let call: Awaited<ReturnType<typeof runCall>>;
    try {
      call = await runCall(scenario, agentId, clinicId);
    } catch (error) {
      if (!isCreditExhausted(error)) throw error;
      console.info("no credit");
      stopped = "Retell credit exhausted";
      break;
    }
    const { callId, startedAt, details } = call;
    const outcome: CallOutcome = {
      ...outcomeOf(details),
      ...(await effects(scenario, clinicId, startedAt, seeded)),
    };
    const failures = [...scenario.check(outcome), ...invariants(outcome)];
    const latency = (details.latency ?? {}) as Record<string, Latency>;
    const cost = (details.call_cost as { combined_cost?: number } | undefined)?.combined_cost ?? 0;
    spent += cost / 100;
    results.push({
      id: scenario.id,
      title: scenario.title,
      category: scenario.category,
      passed: failures.length === 0,
      failures,
      callId,
      durationMs: details.duration_ms,
      costCents: cost,
      latency: { e2e: latency.e2e, llm: latency.llm, tts: latency.tts, asr: latency.asr },
      tools: outcome.tools.map(
        (t) => `${t.name}${t.result?.ok === false ? `(${String(t.result.error)})` : ""}`,
      ),
    });
    save();
    console.info(failures.length === 0 ? "ok" : `FAILED: ${failures.join("; ")}`);
  }

  const passed = results.filter((r) => r.passed).length;
  const cost = results.reduce((sum, r) => sum + r.costCents, 0) / 100;
  console.info(`\n${passed}/${results.length} passed · cost $${cost.toFixed(2)} · ${file}`);
  return { spent, stopped };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
