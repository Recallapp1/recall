import "server-only";

import { eq } from "drizzle-orm";
import type Retell from "retell-sdk";

import type { Executor } from "../../../db";
import { voiceAgents, type VoiceAgent } from "../../../db/schema";
import { findClinicById, loadClinicDirectory } from "../../../domain/clinics";
import { buildRetellAgentSpec, specHash, type AgentSpecInput } from "./agent-spec";
import { RETELL_PROVIDER } from "./config";

/** The slice of the Retell SDK that sync uses; lets tests run against a fake. */
export interface RetellAgentApi {
  llm: {
    create(params: Retell.LlmCreateParams): Promise<{ llm_id: string }>;
    update(llmId: string, params: Retell.LlmUpdateParams): Promise<{ llm_id: string }>;
  };
  agent: {
    create(params: Retell.AgentCreateParams): Promise<{ agent_id: string; version: number }>;
    update(
      agentId: string,
      params: Retell.AgentUpdateParams,
    ): Promise<{ agent_id: string; version: number }>;
  };
}

export interface SyncDeps {
  api: RetellAgentApi;
  config: Pick<AgentSpecInput, "appUrl" | "llmModel" | "defaultVoiceId">;
  /** Push even when the spec is unchanged (e.g. after edits in the Retell dashboard). */
  force?: boolean;
  now?: () => Date;
}

export type SyncResult =
  | { status: "created" | "updated" | "unchanged"; agentId: string; version: number | null }
  | { status: "error"; error: string };

/**
 * Makes the clinic's Retell LLM and agent match our data. Idempotent: an
 * unchanged spec is skipped, and partial progress (LLM created, agent failed)
 * is persisted so the next run resumes instead of creating duplicates.
 */
export async function syncClinicVoiceAgent(
  db: Executor,
  clinicId: string,
  deps: SyncDeps,
): Promise<SyncResult> {
  const now = deps.now ?? (() => new Date());
  const ctx = await findClinicById(db, clinicId);
  if (!ctx) return { status: "error", error: `Clinic not found: ${clinicId}` };

  const [existing] = await db.select().from(voiceAgents).where(eq(voiceAgents.clinicId, clinicId));
  let llmId = existing?.externalLlmId ?? null;
  let agentId = existing?.externalAgentId ?? null;

  try {
    assertPublicUrl(deps.config.appUrl);
    const directory = await loadClinicDirectory(db, clinicId);
    const spec = buildRetellAgentSpec({ ...ctx, directory, ...deps.config });
    const hash = specHash(spec);

    if (!deps.force && existing?.status === "synced" && existing.specHash === hash && agentId) {
      return { status: "unchanged", agentId, version: existing.agentVersion };
    }

    if (llmId) {
      await deps.api.llm.update(llmId, spec.llm);
    } else {
      llmId = (await deps.api.llm.create(spec.llm)).llm_id;
      await saveState(db, clinicId, { externalLlmId: llmId, status: "pending" });
    }

    const agentParams = {
      ...spec.agent,
      response_engine: { type: "retell-llm" as const, llm_id: llmId },
    };
    const agent = agentId
      ? await deps.api.agent.update(agentId, agentParams)
      : await deps.api.agent.create(agentParams);
    const created = !agentId;
    agentId = agent.agent_id;

    await saveState(db, clinicId, {
      externalLlmId: llmId,
      externalAgentId: agentId,
      agentVersion: agent.version,
      specHash: hash,
      status: "synced",
      lastError: null,
      syncedAt: now(),
    });
    return { status: created ? "created" : "updated", agentId, version: agent.version };
  } catch (error) {
    const message = describeError(error);
    await saveState(db, clinicId, { status: "error", lastError: message });
    return { status: "error", error: message };
  }
}

async function saveState(
  db: Executor,
  clinicId: string,
  values: Partial<Omit<VoiceAgent, "id" | "clinicId" | "provider" | "createdAt" | "updatedAt">>,
) {
  await db
    .insert(voiceAgents)
    .values({ clinicId, provider: RETELL_PROVIDER, ...values })
    .onConflictDoUpdate({ target: voiceAgents.clinicId, set: values });
}

/** Retell calls our webhooks, so the URL baked into the agent must be reachable. */
function assertPublicUrl(appUrl: string) {
  const { protocol, hostname } = new URL(appUrl);
  if (protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
    throw new Error(
      `APP_URL must be a public https URL Retell can reach (got ${protocol}//${hostname}). Use a tunnel locally.`,
    );
  }
}

const MAX_ERROR_LENGTH = 500;

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_ERROR_LENGTH);
}
