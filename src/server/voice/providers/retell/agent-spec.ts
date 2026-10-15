import "server-only";

import { createHash } from "node:crypto";

import type Retell from "retell-sdk";

import type { Clinic } from "../../../db/schema";
import type { ClinicSettings } from "../../../domain/clinic-settings";
import type { ClinicDirectory } from "../../../domain/clinics";
import { practitionerDisplayName } from "../../../domain/clinics";
import { spokenTitles } from "../../../domain/speech";
import {
  buildFirstMessage,
  buildSystemPrompt,
  type CallVariables,
  type PromptVariant,
} from "../../prompt";
import { toolParameters, tools } from "../../tools";

type LlmParams = Retell.LlmCreateParams;
type AgentParams = Omit<Retell.AgentCreateParams, "response_engine">;

export interface RetellAgentSpec {
  llm: LlmParams;
  agent: AgentParams;
}

export interface AgentSpecInput {
  clinic: Clinic;
  settings: ClinicSettings;
  directory: ClinicDirectory;
  appUrl: string;
  llmModel: string;
  defaultVoiceId: string | undefined;
  voiceModel?: string | undefined;
  /** Retell's high-priority LLM pool: lower, steadier latency at a higher price. */
  llmHighPriority?: boolean;
  tuning?: VoiceTuning;
}

/**
 * Latency settings from ADR-003 option A. Unset values are not sent, so
 * Retell's defaults apply and the spec (and its hash) stays as it was.
 */
export interface VoiceTuning {
  promptVariant: PromptVariant;
  /** VOICE_PROMPT_HARDENING (audit A9). Unset keeps the prompt unchanged. */
  promptHardening?: boolean;
  /** VOICE_EMERGENCY_FIRST. Unset keeps the prompt unchanged. */
  emergencyFirst?: boolean;
  /** 0–1; Retell's default is 1. */
  responsiveness?: number;
  /** 0–1; Retell's default is 1. */
  interruptionSensitivity?: number;
  dynamicResponsiveness?: boolean;
}

export const RETELL_ROUTES = {
  inbound: "/api/voice/retell/inbound",
  tools: "/api/voice/retell/tools",
  events: "/api/voice/retell/events",
} as const;

const TOOL_NAMES = { endCall: "end_call", transferCall: "transfer_call" } as const;

/** Fallbacks for our call variables, used when no inbound webhook ran (web and test calls). */
const DEFAULT_CALL_VARIABLES: CallVariables = {
  caller_number: "",
  transfer_available: "hayır",
  clinic_status: "active",
};

const MAX_BOOSTED_KEYWORDS = 100;

/**
 * Retell deletes call data (audio, transcript, logs) after this many days
 * (docs/05-compliance/DATA-RETENTION.md: recordings 30 days). Our own copy of
 * the transcript lives on and is cleared by the retention cron.
 */
export const PROVIDER_RETENTION_DAYS = 30;

/**
 * Retell's default summary is English and repeats personal data. Ours is
 * Turkish (shown in the panel) and minimal, because summaries outlive
 * transcripts under the retention policy (docs/05-compliance/DATA-RETENTION.md).
 */
const SUMMARY_INSTRUCTION =
  "Görüşmenin 1-3 cümlelik Türkçe özeti: hastanın talebi, yapılan işlem (randevu, iptal, erteleme, bilgi, geri arama notu) ve varsa açık kalan konu. Hasta adı, telefon numarası veya sağlık şikâyeti ayrıntısı yazma.";

/**
 * Everything Retell needs to run a clinic's assistant, derived purely from our
 * data. Call-time values use Retell's built-in variables (clock, caller) and
 * ours (transfer availability, clinic status), so this spec only changes when
 * the clinic's configuration changes.
 */
export function buildRetellAgentSpec(input: AgentSpecInput): RetellAgentSpec {
  const { clinic, settings, directory, appUrl } = input;
  const voiceId = settings.assistant.voiceId ?? input.defaultVoiceId;
  if (!voiceId) {
    throw new Error(
      "No voice configured: set RETELL_VOICE_ID or the clinic's assistant.voiceId (pnpm voice:voices).",
    );
  }
  const url = (path: string) => new URL(path, appUrl).toString();
  const tz = clinic.timezone;
  const tuning = input.tuning;

  const generalPrompt = buildSystemPrompt({
    clinic,
    settings,
    directory,
    variant: tuning?.promptVariant,
    hardening: tuning?.promptHardening,
    emergencyFirst: tuning?.emergencyFirst,
    toolNames: TOOL_NAMES,
    placeholders: {
      now: `{{current_time_${tz}}}`,
      calendar: `{{current_calendar_${tz}}}`,
      // Ours, not Retell's {{user_number}}: that one is unset on web calls and
      // reaches the LLM as a raw placeholder instead of "unknown".
      callerPhone: "{{caller_number}}",
      transferAvailable: "{{transfer_available}}",
      clinicStatus: "{{clinic_status}}",
    },
  });

  const customTools: LlmParams["general_tools"] = tools.map((tool) => ({
    type: "custom" as const,
    name: tool.name,
    description: tool.description,
    url: url(RETELL_ROUTES.tools),
    method: "POST" as const,
    // Zod emits a JSON Schema object; Retell types `properties` loosely.
    parameters: toolParameters(tool) as unknown as Retell.LlmCreateParams.CustomTool.Parameters,
    speak_during_execution: Boolean(tool.fillerMessage),
    ...(tool.fillerMessage && {
      execution_message_description: tool.fillerMessage,
      execution_message_type: "static_text" as const,
    }),
    speak_after_execution: true,
    timeout_ms: 10_000,
  }));

  const builtInTools: NonNullable<LlmParams["general_tools"]> = [
    {
      type: "end_call",
      name: TOOL_NAMES.endCall,
      description:
        "Hasta ile vedalaştıktan sonra, görüşme doğal olarak bittiğinde aramayı sonlandırır.",
    },
  ];
  if (clinic.transferPhoneNumber) {
    builtInTools.push({
      type: "transfer_call",
      name: TOOL_NAMES.transferCall,
      description:
        "Aramayı klinik ekibine aktarır. Sadece transfer_available 'evet' iken, acil durumda veya hasta insanla görüşmek istediğinde kullan.",
      transfer_destination: { type: "predefined", number: clinic.transferPhoneNumber },
      transfer_option: { type: "cold_transfer" },
      speak_during_execution: true,
      execution_message_description: "Sizi klinikteki arkadaşıma aktarıyorum, lütfen hatta kalın.",
      execution_message_type: "static_text",
    });
  }

  return {
    llm: {
      model: input.llmModel as LlmParams["model"],
      model_temperature: 0,
      ...(input.llmHighPriority && { model_high_priority: true }),
      start_speaker: "agent",
      begin_message: buildFirstMessage(clinic, settings),
      general_prompt: generalPrompt,
      general_tools: [...(customTools ?? []), ...builtInTools],
      default_dynamic_variables: { ...DEFAULT_CALL_VARIABLES },
    },
    agent: {
      agent_name: `Recall · ${clinic.name}`.slice(0, 100),
      voice_id: voiceId,
      ...(input.voiceModel && {
        voice_model: input.voiceModel as AgentParams["voice_model"],
      }),
      language: "tr-TR",
      ...(tuning?.responsiveness !== undefined && { responsiveness: tuning.responsiveness }),
      ...(tuning?.interruptionSensitivity !== undefined && {
        interruption_sensitivity: tuning.interruptionSensitivity,
      }),
      ...(tuning?.dynamicResponsiveness !== undefined && {
        enable_dynamic_responsiveness: tuning.dynamicResponsiveness,
      }),
      timezone: tz,
      webhook_url: url(RETELL_ROUTES.events),
      webhook_events: ["call_started", "call_ended", "call_analyzed"],
      boosted_keywords: boostedKeywords(directory),
      end_call_after_silence_ms: 20_000,
      max_call_duration_ms: settings.limits.maxCallMinutes * 60_000,
      data_storage_retention_days: PROVIDER_RETENTION_DAYS,
      // Recording links expire (24 h); the panel asks for a fresh one per playback.
      opt_in_signed_url: true,
      post_call_analysis_data: [
        { type: "system-presets", name: "call_summary", description: SUMMARY_INSTRUCTION },
      ],
    },
  };
}

/** Clinic-specific words the speech recogniser should favour: names and services. */
function boostedKeywords(directory: ClinicDirectory): string[] {
  const words = [
    ...directory.practitioners.map((p) => spokenTitles(practitionerDisplayName(p))),
    ...directory.practitioners.map((p) => p.name),
    ...directory.services.flatMap((s) => [s.name, ...s.aliases]),
  ];
  return [...new Set(words.map((w) => w.trim()).filter(Boolean))].slice(0, MAX_BOOSTED_KEYWORDS);
}

/** Stable digest of a spec; unchanged specs are not pushed again. */
export function specHash(spec: RetellAgentSpec): string {
  return createHash("sha256").update(stableStringify(spec)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
