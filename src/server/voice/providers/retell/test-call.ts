import "server-only";

import { eq } from "drizzle-orm";

import { env } from "@/lib/env";

import { db } from "../../../db";
import { voiceAgents } from "../../../db/schema";
import { findClinicById, loadClinicDirectory } from "../../../domain/clinics";
import { buildCallVariables } from "../../prompt";
import { retellClient } from "./config";

/** What the browser client needs to join the call (token, transport, ICE servers). */
export interface TestWebCall {
  accessToken: string;
  callId: string;
  transport: "gateway";
  iceServers: { urls: string | string[]; credential?: string; username?: string }[];
}

/**
 * Starts a browser test call with the clinic's own agent (panel "Test
 * araması"). The token is single-use and short-lived; the API key never leaves
 * the server. The call is stamped like a phone call so tools resolve the clinic.
 */
export async function createTestWebCall(clinicId: string): Promise<TestWebCall | null> {
  if (!env().RETELL_API_KEY) return null;
  const [agent] = await db()
    .select({ agentId: voiceAgents.externalAgentId, version: voiceAgents.agentVersion })
    .from(voiceAgents)
    .where(eq(voiceAgents.clinicId, clinicId));
  const ctx = await findClinicById(db(), clinicId);
  if (!agent?.agentId || !ctx) return null;

  const directory = await loadClinicDirectory(db(), clinicId);
  const call = await retellClient().call.createWebCall({
    agent_id: agent.agentId,
    ...(agent.version != null && { agent_version: agent.version }),
    metadata: { clinic_id: clinicId, test_call: true },
    retell_llm_dynamic_variables: {
      ...buildCallVariables(ctx.clinic, directory.clinicHours, new Date()),
    },
  });
  return {
    accessToken: call.access_token,
    callId: call.call_id,
    transport: call.transport,
    iceServers: call.ice_servers,
  };
}
