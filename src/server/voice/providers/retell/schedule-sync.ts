import "server-only";

import { eq } from "drizzle-orm";
import { after } from "next/server";

import { env } from "@/lib/env";
import { db } from "../../../db";
import { voiceAgents } from "../../../db/schema";
import { raiseAlarm } from "../../../observability/alarm";
import { retellClient, retellConfig } from "./config";
import { syncClinicVoiceAgent, type SyncResult } from "./sync";

/** Pushes the clinic's current data to its existing Retell agent now. */
export async function syncAssistantNow(clinicId: string): Promise<SyncResult | null> {
  if (!env().RETELL_API_KEY) return null;
  // Agents are created by the Recall team (voice:sync / F6); the panel only updates them.
  const [agent] = await db()
    .select({ id: voiceAgents.id })
    .from(voiceAgents)
    .where(eq(voiceAgents.clinicId, clinicId));
  if (!agent) return null;

  const config = retellConfig();
  return syncClinicVoiceAgent(db(), clinicId, {
    api: retellClient(),
    config: {
      appUrl: config.appUrl,
      llmModel: config.llmModel,
      defaultVoiceId: config.defaultVoiceId,
      voiceModel: config.voiceModel,
      llmHighPriority: config.llmHighPriority,
      tuning: config.tuning,
    },
  });
}

/**
 * After a settings change: sync once the response has been sent. A failure
 * is an alarm (full audit FA-14): the assistant keeps speaking from the old
 * settings (hours, services) until someone syncs it.
 */
export function scheduleAssistantSync(
  clinicId: string,
  sync: (clinicId: string) => Promise<SyncResult | null> = syncAssistantNow,
): void {
  after(async () => {
    try {
      const result = await sync(clinicId);
      if (result?.status === "error") {
        // Provider messages carry no patient data (sync.ts: describeError).
        raiseAlarm("voice.sync_failed", { clinicId, error: result.error.slice(0, 200) });
      }
    } catch (error) {
      raiseAlarm("voice.sync_failed", { clinicId }, error);
    }
  });
}

export interface AssistantSyncStatus {
  status: "pending" | "synced" | "error";
  syncedAt: Date | null;
  /** Provider message; never contains patient data. */
  lastError: string | null;
}

/** Sync state shown on the assistant settings page; null when no agent exists. */
export async function assistantSyncStatus(clinicId: string): Promise<AssistantSyncStatus | null> {
  const [agent] = await db()
    .select({
      status: voiceAgents.status,
      syncedAt: voiceAgents.syncedAt,
      lastError: voiceAgents.lastError,
    })
    .from(voiceAgents)
    .where(eq(voiceAgents.clinicId, clinicId));
  return agent ?? null;
}

/**
 * Console (F6): creates the clinic's agent if it has none, otherwise syncs it.
 * `force` pushes even an unchanged spec (after edits in the Retell dashboard).
 */
export async function ensureAssistant(clinicId: string, force = false): Promise<SyncResult> {
  const config = retellConfig();
  return syncClinicVoiceAgent(db(), clinicId, {
    api: retellClient(),
    config: {
      appUrl: config.appUrl,
      llmModel: config.llmModel,
      defaultVoiceId: config.defaultVoiceId,
      voiceModel: config.voiceModel,
      llmHighPriority: config.llmHighPriority,
      tuning: config.tuning,
    },
    force,
  });
}
