import "server-only";

/**
 * Provider-neutral entry point for keeping a clinic's voice assistant in sync
 * with its data. The panel calls these; the provider lives behind them.
 */
export {
  assistantSyncStatus,
  ensureAssistant,
  scheduleAssistantSync,
  syncAssistantNow,
  type AssistantSyncStatus,
} from "./providers/retell/schedule-sync";
export {
  deleteProviderCall,
  deleteVoiceProviderCall,
  freshRecordingUrl,
} from "./providers/retell/recordings";
export {
  defaultAssistantVoiceId,
  listAssistantVoices,
  type AssistantVoice,
} from "./providers/retell/voices";
export {
  createTestWebCall,
  type TestWebCall,
  type TestWebCallResult,
} from "./providers/retell/test-call";
