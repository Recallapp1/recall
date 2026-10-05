import "server-only";

import { eq } from "drizzle-orm";

import { env } from "@/lib/env";

import { db } from "../../../db";
import { voiceAgents } from "../../../db/schema";
import { findClinicById, loadClinicDirectory } from "../../../domain/clinics";
import { buildCallVariables } from "../../prompt";
import { retellClient, retellConfig } from "./config";
import { syncAssistantNow } from "./schedule-sync";

/** What the browser client needs to join the call (token, transport, ICE servers). */
export interface TestWebCall {
  accessToken: string;
  callId: string;
  transport: "gateway";
  iceServers: { urls: string | string[]; credential?: string; username?: string }[];
}

export type TestWebCallResult =
  | { ok: true; call: TestWebCall }
  | { ok: false; reason: "not_configured" | "no_agent" | "sync_failed" | "unreachable" };

const REACHABILITY_TIMEOUT_MS = 5_000;

/**
 * Whether Retell can reach our tool and event webhooks at `appUrl`. Probes the
 * public health route, so a dead tunnel or a wrong APP_URL is caught before a
 * call starts and the assistant would tell the caller "bağlantı sorunu".
 */
export async function isAppUrlReachable(
  appUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetchImpl(new URL("/api/health", appUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Starts a browser test call with the clinic's own agent (panel "Test
 * araması"). The token is single-use and short-lived; the API key never leaves
 * the server. The call is stamped like a phone call so tools resolve the clinic.
 */
export async function createTestWebCall(clinicId: string): Promise<TestWebCallResult> {
  if (!env().RETELL_API_KEY) return { ok: false, reason: "not_configured" };

  // The agent carries our webhook URLs; resync first so a changed APP_URL (new
  // tunnel, new deployment) is pushed. Unchanged specs skip the Retell API.
  const sync = await syncAssistantNow(clinicId);
  if (!sync) return { ok: false, reason: "no_agent" };
  if (sync.status === "error") return { ok: false, reason: "sync_failed" };
  const reachable = await isAppUrlReachable(retellConfig().appUrl);
  if (!reachable) return { ok: false, reason: "unreachable" };

  const [agent] = await db()
    .select({ agentId: voiceAgents.externalAgentId, version: voiceAgents.agentVersion })
    .from(voiceAgents)
    .where(eq(voiceAgents.clinicId, clinicId));
  const ctx = await findClinicById(db(), clinicId);
  if (!agent?.agentId || !ctx) return { ok: false, reason: "no_agent" };

  const directory = await loadClinicDirectory(db(), clinicId);
  const call = await retellClient().call.createWebCall({
    agent_id: agent.agentId,
    ...(agent.version != null && { agent_version: agent.version }),
    metadata: { clinic_id: clinicId, test_call: true },
    retell_llm_dynamic_variables: {
      // A browser has no caller id; the assistant asks for the number to book.
      ...buildCallVariables(ctx.clinic, directory.clinicHours, new Date(), null),
    },
  });
  return {
    ok: true,
    call: {
      accessToken: call.access_token,
      callId: call.call_id,
      transport: call.transport,
      iceServers: call.ice_servers,
    },
  };
}
