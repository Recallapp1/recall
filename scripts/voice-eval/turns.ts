/** A turn of Retell's `transcript_with_tool_calls`; words carry start/end in seconds. */
export interface TranscriptTurn {
  role: string;
  content?: string;
  words?: Array<{ word: string; start: number; end: number }>;
}

/**
 * Inside one scripted line the caller pauses at most 2.5 s ({longPause});
 * between lines the audio is silent for the turn gap (13 s by default). A
 * caller resuming sooner than half the gap is still on the same line.
 */
export const SAME_LINE_MS = 6_500;

/**
 * Times the assistant started speaking in a caller's pause and the caller then
 * went on with the same line. Retell also splits a caller's line into several
 * turns when nobody else spoke; those are not cut-ins. Neither is the caller
 * talking over an assistant who was already speaking.
 */
export function cutIns(turns: readonly TranscriptTurn[], sameLineMs = SAME_LINE_MS): number {
  let count = 0;
  let lastUserEnd: number | null = null;
  let agentStartedInPause = false;
  for (const turn of turns) {
    const first = turn.words?.[0];
    const last = turn.words?.at(-1);
    if (!first || !last) continue;
    if (turn.role === "agent") {
      if (lastUserEnd !== null && first.start >= lastUserEnd) agentStartedInPause = true;
    } else if (turn.role === "user") {
      if (
        agentStartedInPause &&
        lastUserEnd !== null &&
        (first.start - lastUserEnd) * 1000 < sameLineMs
      ) {
        count += 1;
      }
      lastUserEnd = last.end;
      agentStartedInPause = false;
    }
  }
  return count;
}
