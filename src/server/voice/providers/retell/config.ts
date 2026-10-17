import "server-only";

import Retell from "retell-sdk";

import { env } from "@/lib/env";

import type { VoiceTuning } from "./agent-spec";

export const RETELL_PROVIDER = "retell";

export interface RetellConfig {
  apiKey: string;
  appUrl: string;
  llmModel: string;
  /** Fallback voice for clinics that have not chosen one. */
  defaultVoiceId: string | undefined;
  /** TTS model; unset means Retell's default for the voice. */
  voiceModel: string | undefined;
  llmHighPriority: boolean;
  tuning: VoiceTuning;
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
    voiceModel: config.RETELL_VOICE_MODEL,
    llmHighPriority: config.RETELL_LLM_HIGH_PRIORITY,
    tuning: {
      promptVariant: config.VOICE_PROMPT_VARIANT,
      promptHardening: config.VOICE_PROMPT_HARDENING,
      emergencyFirst: config.VOICE_EMERGENCY_FIRST,
      emergencyEndCall: config.VOICE_EMERGENCY_END_CALL,
      responsiveness: config.RETELL_RESPONSIVENESS,
      interruptionSensitivity: config.RETELL_INTERRUPTION_SENSITIVITY,
      dynamicResponsiveness: config.RETELL_DYNAMIC_RESPONSIVENESS,
    },
  };
}

let client: Retell | undefined;

export function retellClient(): Retell {
  client ??= new Retell({ apiKey: retellConfig().apiKey });
  return client;
}
