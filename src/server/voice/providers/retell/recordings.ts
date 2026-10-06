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

/** Deletes the provider's copy of calls it handled; others are skipped. */
export async function deleteProviderCalls(
  items: { provider: string; providerCallId: string }[],
): Promise<void> {
  for (const item of items) {
    if (item.provider === RETELL_PROVIDER) await deleteProviderCall(item.providerCallId);
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && error.status === 404;
}
