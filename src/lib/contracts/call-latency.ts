/** Latency of one component over a call, in milliseconds. */
export interface LatencyStats {
  p50: number | null;
  p90: number | null;
  max: number | null;
}

/** Per-call latency: end-to-end and per component (speech-to-text, model, text-to-speech). */
export type CallLatency = Partial<Record<"e2e" | "asr" | "llm" | "tts", LatencyStats>>;
