import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb } from "@/test/db";

import type { Database } from "../../../db";
import { clinics, services, voiceAgents } from "../../../db/schema";
import { syncClinicVoiceAgent, type RetellAgentApi, type SyncDeps } from "./sync";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

/** Records calls and mimics Retell's id and version behaviour. */
function fakeRetell(options: { failAgentCreate?: boolean } = {}) {
  const calls: string[] = [];
  // Real Retell ids are globally unique; the DB enforces that too.
  const suffix = crypto.randomUUID().slice(0, 8);
  const ids = { llm: `llm_${suffix}`, agent: `agent_${suffix}` };
  let version = 0;
  const api: RetellAgentApi = {
    llm: {
      create: async () => (calls.push("llm.create"), { llm_id: ids.llm }),
      update: async (id) => (calls.push(`llm.update:${id}`), { llm_id: id }),
    },
    agent: {
      create: async (params) => {
        calls.push("agent.create");
        if (options.failAgentCreate) throw new Error("400 invalid voice_id");
        expect(params.response_engine).toMatchObject({ type: "retell-llm" });
        return { agent_id: ids.agent, version };
      },
      update: async (id) => (
        calls.push(`agent.update:${id}`),
        { agent_id: id, version: ++version }
      ),
    },
  };
  return { api, calls, ids };
}

const config: SyncDeps["config"] = {
  appUrl: "https://recall.example",
  llmModel: "claude-5-sonnet",
  defaultVoiceId: "voice-1",
};

let clinicId: string;

beforeEach(async () => {
  const [clinic] = await db
    .insert(clinics)
    .values({ slug: `sync-${crypto.randomUUID()}`, name: "Senkron Kliniği" })
    .returning();
  clinicId = clinic.id;
  await db.insert(services).values({ clinicId, name: "Muayene", durationMinutes: 20 });
});

async function agentRow() {
  const [row] = await db.select().from(voiceAgents).where(eq(voiceAgents.clinicId, clinicId));
  return row;
}

describe("syncClinicVoiceAgent", () => {
  it("creates the LLM and agent once, then skips unchanged specs", async () => {
    const { api, calls, ids } = fakeRetell();

    const first = await syncClinicVoiceAgent(db, clinicId, { api, config });
    expect(first).toEqual({ status: "created", agentId: ids.agent, version: 0 });
    expect(await agentRow()).toMatchObject({
      provider: "retell",
      externalAgentId: ids.agent,
      externalLlmId: ids.llm,
      agentVersion: 0,
      status: "synced",
      lastError: null,
    });

    const second = await syncClinicVoiceAgent(db, clinicId, { api, config });
    expect(second.status).toBe("unchanged");
    expect(calls).toEqual(["llm.create", "agent.create"]);
  });

  it("updates in place when clinic data changes", async () => {
    const { api, calls, ids } = fakeRetell();
    await syncClinicVoiceAgent(db, clinicId, { api, config });

    await db.insert(services).values({ clinicId, name: "Dolgu", durationMinutes: 45 });
    const result = await syncClinicVoiceAgent(db, clinicId, { api, config });

    expect(result).toEqual({ status: "updated", agentId: ids.agent, version: 1 });
    expect(calls).toEqual([
      "llm.create",
      "agent.create",
      `llm.update:${ids.llm}`,
      `agent.update:${ids.agent}`,
    ]);
    expect((await agentRow()).agentVersion).toBe(1);
  });

  it("forces a push even when nothing changed", async () => {
    const { api, calls, ids } = fakeRetell();
    await syncClinicVoiceAgent(db, clinicId, { api, config });
    await syncClinicVoiceAgent(db, clinicId, { api, config, force: true });
    expect(calls).toContain(`agent.update:${ids.agent}`);
  });

  it("keeps partial progress so a retry reuses the created LLM", async () => {
    const failing = fakeRetell({ failAgentCreate: true });
    const result = await syncClinicVoiceAgent(db, clinicId, { api: failing.api, config });

    expect(result).toEqual({ status: "error", error: "400 invalid voice_id" });
    expect(await agentRow()).toMatchObject({
      externalLlmId: failing.ids.llm,
      externalAgentId: null,
      status: "error",
      lastError: "400 invalid voice_id",
    });

    const retry = fakeRetell();
    await syncClinicVoiceAgent(db, clinicId, { api: retry.api, config });
    expect(retry.calls).toEqual([`llm.update:${failing.ids.llm}`, "agent.create"]);
  });

  it("refuses URLs Retell cannot reach", async () => {
    const { api, calls } = fakeRetell();
    const result = await syncClinicVoiceAgent(db, clinicId, {
      api,
      config: { ...config, appUrl: "http://localhost:3000" },
    });
    expect(result.status).toBe("error");
    expect(calls).toEqual([]);
  });

  it("reports a missing voice instead of calling Retell", async () => {
    const { api, calls } = fakeRetell();
    const result = await syncClinicVoiceAgent(db, clinicId, {
      api,
      config: { ...config, defaultVoiceId: undefined },
    });
    expect(result).toMatchObject({ status: "error" });
    expect(calls).toEqual([]);
  });
});
