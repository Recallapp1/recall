import type { Metadata } from "next";

import { can, requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { loadClinicDirectory } from "@/server/domain/clinics";
import { buildSystemPrompt } from "@/server/voice/prompt";
import { env } from "@/lib/env";
import { safeError } from "@/lib/safe-error";
import {
  assistantSyncStatus,
  defaultAssistantVoiceId,
  listAssistantVoices,
  type AssistantVoice,
} from "@/server/voice/sync";

import { AssistantForm, SyncStatusCard } from "./assistant-form";
import { TestCall } from "./test-call";
import { VoicePicker } from "./voice-picker";

export const metadata: Metadata = { title: "Asistan" };

export default async function AssistantSettingsPage() {
  const { clinic, settings } = await requirePermission({ assistantSettings: ["read"] });
  const [editable, directory, syncStatus, voices] = await Promise.all([
    can({ assistantSettings: ["update"] }),
    loadClinicDirectory(db(), clinic.id),
    assistantSyncStatus(clinic.id),
    loadVoices(),
  ]);
  const defaultVoiceId = syncStatus ? defaultAssistantVoiceId() : undefined;
  const defaultVoice = voices.find((voice) => voice.id === defaultVoiceId) ?? null;

  // Readable stand-ins for values the phone platform fills in during a call.
  const prompt = buildSystemPrompt({
    clinic,
    settings,
    directory,
    // The wording the live assistant uses (ADR-003 option A).
    variant: env().VOICE_PROMPT_VARIANT,
    hardening: env().VOICE_PROMPT_HARDENING,
    toolNames: { endCall: "end_call", transferCall: "transfer_call" },
    placeholders: {
      now: "[arama anındaki tarih ve saat]",
      calendar: "[önümüzdeki günlerin listesi]",
      callerPhone: "[arayanın numarası]",
      transferAvailable: "[aktarma uygun mu]",
      clinicStatus: "[klinik durumu]",
    },
  });

  return (
    <>
      <SyncStatusCard status={syncStatus} editable={editable} />
      {editable && syncStatus && <TestCall />}
      {syncStatus && (
        <VoicePicker
          voices={voices}
          selected={settings.assistant.voiceId ?? null}
          defaultVoice={defaultVoice}
          editable={editable}
        />
      )}
      <AssistantForm
        editable={editable}
        initial={{
          name: settings.assistant.name,
          greeting: settings.assistant.greeting ?? "",
          speakPrices: settings.assistant.speakPrices,
          recordCalls: settings.assistant.recordCalls,
          extraInstructions: settings.assistant.extraInstructions ?? "",
          faq: settings.assistant.faq,
        }}
      />
      <details className="group rounded-card border border-hairline bg-paper">
        <summary className="cursor-pointer px-6 py-5 text-lg font-semibold tracking-tight text-heading">
          Asistanın talimatlarını önizle
        </summary>
        <div className="border-t border-hairline px-6 py-5">
          <p className="mb-3 text-sm text-body">
            Asistan aramalarda bu talimatlarla çalışır. Köşeli parantezli değerler arama anında
            doldurulur.
          </p>
          <pre className="max-h-[32rem] overflow-auto rounded-card-sm bg-canvas p-4 text-xs leading-relaxed whitespace-pre-wrap text-heading">
            {prompt}
          </pre>
        </div>
      </details>
    </>
  );
}

/** The page still works when the voice platform is unreachable; the picker says so. */
async function loadVoices(): Promise<AssistantVoice[]> {
  try {
    return await listAssistantVoices();
  } catch (error) {
    console.error(JSON.stringify({ msg: "voice.list_failed", error: safeError(error) }));
    return [];
  }
}
