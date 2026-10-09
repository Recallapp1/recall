import "server-only";

import { RETELL_PROVIDER, retellClient } from "./config";

/**
 * A playable recording link for one call. Agents use signed URLs that expire,
 * so the stored link is only a marker that a recording existed; a fresh one is
 * fetched per playback. Null once the provider has deleted the call.
 */
export async function freshRecordingUrl(providerCallId: string): Promise<string | null> {
  try {
    const call = await retellClient().call.retrieve(providerCallId);
    // The provider must answer for exactly the call we asked about (audit A4).
    if (call.call_id !== providerCallId) {
      console.error(JSON.stringify({ msg: "recording.provider_call_mismatch" }));
      return null;
    }
    return call.recording_url ?? null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** Providers whose recordings the panel can fetch. */
export const RECORDING_PROVIDERS: readonly string[] = [RETELL_PROVIDER];

/** Deletes the call (audio, transcript, logs) on the provider's side. */
export async function deleteProviderCall(providerCallId: string): Promise<void> {
  try {
    await retellClient().call.delete(providerCallId);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

/** Deletes a call on the provider that handled it (the deletion queue's worker). */
export async function deleteVoiceProviderCall(
  provider: string,
  providerCallId: string,
): Promise<void> {
  if (provider !== RETELL_PROVIDER) throw new Error(`Unsupported voice provider: ${provider}`);
  await deleteProviderCall(providerCallId);
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && error.status === 404;
}
