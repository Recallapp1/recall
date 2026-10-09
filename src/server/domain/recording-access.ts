import "server-only";

/**
 * Which provider call a playback may fetch (audit A4). The panel asks for a
 * recording by our call id; before anything goes to the provider, the row we
 * loaded must belong to the signed-in member's clinic, come from a provider
 * we support and carry a provider call id. Anything else is refused.
 */
export interface RecordingTarget {
  provider: string;
  providerCallId: string;
}

export function recordingTarget(
  call: { clinicId: string; provider: string; providerCallId: string; recordingUrl: string | null },
  expected: { clinicId: string; providers: readonly string[] },
): RecordingTarget | null {
  if (call.clinicId !== expected.clinicId) return null;
  if (!expected.providers.includes(call.provider)) return null;
  if (!call.providerCallId.trim()) return null;
  if (!call.recordingUrl) return null;
  return { provider: call.provider, providerCallId: call.providerCallId };
}
