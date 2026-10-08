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
    return call.recording_url ?? null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

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
