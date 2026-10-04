import "server-only";

import Retell from "retell-sdk";

import { env } from "@/lib/env";

export const RETELL_PROVIDER = "retell";

export interface RetellConfig {
  apiKey: string;
  appUrl: string;
  llmModel: string;
  /** Fallback voice for clinics that have not chosen one. */
  defaultVoiceId: string | undefined;
}

/** Retell settings, failing loudly when voice is used without being configured. */
export function retellConfig(): RetellConfig {
  const config = env();
  if (!config.RETELL_API_KEY) {
    throw new Error("RETELL_API_KEY is not set. See docs/02-voice-agent/RETELL-SETUP.md (step 2).");
  }
  return {
    apiKey: config.RETELL_API_KEY,
    appUrl: config.APP_URL,
    llmModel: config.RETELL_LLM_MODEL,
    defaultVoiceId: config.RETELL_VOICE_ID,
  };
}

let client: Retell | undefined;

export function retellClient(): Retell {
  client ??= new Retell({ apiKey: retellConfig().apiKey });
  return client;
}
