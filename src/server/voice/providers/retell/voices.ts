import "server-only";

import type Retell from "retell-sdk";

import { retellClient, retellConfig } from "./config";

/** A voice a clinic can pick for its assistant (provider-neutral shape). */
export interface AssistantVoice {
  id: string;
  name: string;
  gender: "female" | "male";
  /** The provider's sample clip; Retell's samples are in English. */
  previewUrl: string | null;
}

const CACHE_MS = 60 * 60 * 1000;
let cache: { at: number; voices: AssistantVoice[] } | undefined;

/**
 * The TTS model is shared by every clinic (RETELL_VOICE_MODEL), and Retell
 * rejects a voice from another provider, so only that provider's voices fit.
 */
export function compatibleProvider(voiceModel: string | undefined): string | null {
  if (!voiceModel) return null;
  return voiceModel.startsWith("eleven_") ? "elevenlabs" : null;
}

export function toAssistantVoices(
  voices: Retell.VoiceResponse[],
  provider: string | null,
): AssistantVoice[] {
  return (
    voices
      .filter((voice) => !provider || voice.provider === provider)
      // Language-localized variants (e.g. "…-Latin-America-Spanish-localized") duplicate a name.
      .filter((voice) => !/localized/i.test(voice.voice_id))
      .map((voice) => ({
        id: voice.voice_id,
        // Retell appends locale tags like "(en-IN)" or "(UK)"; they mean nothing in a Turkish call.
        name: voice.voice_name.replace(/\s*\([^)]*\)$/, ""),
        gender: voice.gender,
        previewUrl: voice.preview_audio_url ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
  );
}

/** Voices for the assistant settings page; cached, the catalogue rarely changes. */
export async function listAssistantVoices(): Promise<AssistantVoice[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.voices;
  const config = retellConfig();
  const voices = toAssistantVoices(
    await retellClient().voice.list(),
    compatibleProvider(config.voiceModel),
  );
  cache = { at: Date.now(), voices };
  return voices;
}

/** The voice used when a clinic has not chosen one. */
export function defaultAssistantVoiceId(): string | undefined {
  return retellConfig().defaultVoiceId;
}
