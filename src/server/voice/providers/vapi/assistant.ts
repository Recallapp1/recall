import "server-only";

import type { Clinic } from "../../../db/schema";
import type { ClinicSettings } from "../../../domain/clinic-settings";
import type { ClinicDirectory } from "../../../domain/clinics";
import { buildFirstMessage, buildSystemPrompt, isWithinClinicHours } from "../../prompt";
import { toolParameters, tools } from "../../tools";

export interface VoicePipelineConfig {
  llmModel: string;
  transcriberProvider: string;
  transcriberModel: string;
  ttsProvider: string;
  ttsVoiceId: string;
}

export interface BuildAssistantInput {
  clinic: Clinic;
  settings: ClinicSettings;
  directory: ClinicDirectory;
  callerPhone: string | null;
  now: Date;
  serverUrl: string;
  serverSecret: string;
  pipeline: VoicePipelineConfig;
}

const PAUSED_TOOLS = new Set(["create_callback_request"]);

/**
 * Transient Vapi assistant for one call, returned from `assistant-request`.
 * One codebase serves every clinic: everything clinic-specific comes from data.
 * Field reference: https://docs.vapi.ai (verify when upgrading the integration).
 */
export function buildVapiAssistant(input: BuildAssistantInput) {
  const { clinic, settings, directory, pipeline } = input;
  const paused = clinic.status === "paused";
  const transferAvailable =
    Boolean(clinic.transferPhoneNumber) &&
    isWithinClinicHours(directory.clinicHours, input.now, clinic.timezone);

  let systemPrompt = buildSystemPrompt({
    clinic,
    settings,
    directory,
    callerPhone: input.callerPhone,
    transferAvailable,
    now: input.now,
  });
  if (paused) {
    systemPrompt +=
      "\n\n# Önemli\nKlinik şu anda yeni randevu almıyor. Hastaya bunu nazikçe söyle ve create_callback_request ile geri arama notu bırakmayı teklif et.";
  }

  const functionTools = tools
    .filter((tool) => !paused || PAUSED_TOOLS.has(tool.name))
    .map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: toolParameters(tool),
      },
      ...(tool.fillerMessage && {
        messages: [{ type: "request-start" as const, content: tool.fillerMessage }],
      }),
    }));

  const platformTools = [
    { type: "endCall" as const },
    ...(transferAvailable
      ? [
          {
            type: "transferCall" as const,
            destinations: [
              {
                type: "number" as const,
                number: clinic.transferPhoneNumber!,
                message: "Sizi klinikteki arkadaşıma aktarıyorum, lütfen hatta kalın.",
              },
            ],
          },
        ]
      : []),
  ];

  return {
    name: clinic.name.slice(0, 40),
    firstMessage: buildFirstMessage(clinic, settings),
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "anthropic",
      model: pipeline.llmModel,
      messages: [{ role: "system", content: systemPrompt }],
      tools: [...functionTools, ...platformTools],
    },
    transcriber: {
      provider: pipeline.transcriberProvider,
      model: pipeline.transcriberModel,
      language: "tr",
    },
    voice: {
      provider: pipeline.ttsProvider,
      voiceId: settings.assistant.voiceId ?? pipeline.ttsVoiceId,
    },
    server: { url: input.serverUrl, secret: input.serverSecret },
    serverMessages: ["tool-calls", "end-of-call-report", "status-update"],
    artifactPlan: { recordingEnabled: settings.assistant.recordCalls },
    silenceTimeoutSeconds: 20,
    maxDurationSeconds: 15 * 60,
    endCallMessage: "Aradığınız için teşekkürler, iyi günler dilerim.",
    metadata: { clinicId: clinic.id },
  };
}
