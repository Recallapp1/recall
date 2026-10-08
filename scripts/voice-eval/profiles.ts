/**
 * Assistant configurations the evaluation can compare on the same scenarios
 * (docs/decisions/ADR-003-llm-model.md). A profile only re-syncs the **dev**
 * clinic's agent for the run and restores the env configuration afterwards;
 * production follows its own env settings and is never touched.
 *
 *   pnpm voice:eval --plan                 # list profiles and estimated cost
 *   pnpm voice:eval --profile option-a     # run all scenarios with a profile
 */
import type { VoiceTuning } from "@/server/voice/providers/retell/agent-spec";

export interface EvalProfile {
  id: string;
  title: string;
  llmModel: string;
  tuning: VoiceTuning;
  /** Listed Retell price, $/min: infrastructure + LLM + ElevenLabs (2026-10-08). */
  listPricePerMinute: number;
}

const INFRA = 0.055;
const ELEVENLABS = 0.04;

/**
 * Option A turn-taking: Retell's responsiveness stays at its default (1,
 * already its fastest), and dynamic responsiveness lets it wait longer for
 * slow speakers. Interruption sensitivity stays at the default.
 */
const OPTION_A: VoiceTuning = { promptVariant: "compact", dynamicResponsiveness: true };

export const profiles: EvalProfile[] = [
  {
    id: "baseline",
    title: "Production today: Haiku, full prompt, Retell defaults",
    llmModel: "claude-4.5-haiku",
    tuning: { promptVariant: "full" },
    listPricePerMinute: INFRA + 0.025 + ELEVENLABS,
  },
  {
    id: "option-a",
    title: "Option A: Haiku, compact prompt, dynamic responsiveness",
    llmModel: "claude-4.5-haiku",
    tuning: OPTION_A,
    listPricePerMinute: INFRA + 0.025 + ELEVENLABS,
  },
  {
    id: "option-c-gemini",
    title: "Option C: Gemini 3.0 Flash with option A settings",
    llmModel: "gemini-3.0-flash",
    tuning: OPTION_A,
    listPricePerMinute: INFRA + 0.016 + ELEVENLABS,
  },
  {
    id: "option-c-gpt",
    title: "Option C: GPT 4.1 mini with option A settings",
    llmModel: "gpt-4.1-mini",
    tuning: OPTION_A,
    listPricePerMinute: INFRA + 0.0128 + ELEVENLABS,
  },
];

/**
 * First run (2026-10-08, 12 calls): 1.26 min per call on average, billed
 * $0.153/min against a listed $0.120/min (Retell adds per-call charges).
 */
export const MEASURED = { minutesPerCall: 1.26, billedOverListed: 0.153 / 0.12 };

export function estimatedCost(profile: EvalProfile, calls: number): number {
  return calls * MEASURED.minutesPerCall * profile.listPricePerMinute * MEASURED.billedOverListed;
}
