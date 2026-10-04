import { describe, expect, it } from "vitest";

import type { Clinic } from "../../../db/schema";
import { parseClinicSettings } from "../../../domain/clinic-settings";
import { buildRetellAgentSpec, specHash, type AgentSpecInput } from "./agent-spec";

const clinic: Clinic = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "gulus-dis",
  organizationId: null,
  name: "Gülüş Diş Kliniği",
  timezone: "Europe/Istanbul",
  transferPhoneNumber: null,
  address: null,
  settings: {},
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function input(overrides: Partial<AgentSpecInput> = {}): AgentSpecInput {
  return {
    clinic,
    settings: parseClinicSettings({ assistant: { name: "Elif" } }),
    directory: {
      clinicHours: [{ weekday: 1, startTime: "09:00:00", endTime: "18:00:00" }],
      practitioners: [{ id: "p-1", name: "Can Demir", title: "Dt." }],
      services: [
        {
          id: "s-1",
          name: "Diş Taşı Temizliği",
          aliases: ["temizlik"],
          durationMinutes: 30,
          priceMin: null,
          priceMax: null,
        },
      ],
    },
    appUrl: "https://recall.example",
    llmModel: "claude-5-sonnet",
    defaultVoiceId: "voice-default",
    ...overrides,
  };
}

const toolNames = (spec: ReturnType<typeof buildRetellAgentSpec>) =>
  spec.llm.general_tools?.map((tool) => tool.name);

describe("buildRetellAgentSpec", () => {
  it("configures a Turkish agent that reports to our events webhook", () => {
    const { agent } = buildRetellAgentSpec(input());
    expect(agent).toMatchObject({
      agent_name: "Recall · Gülüş Diş Kliniği",
      voice_id: "voice-default",
      language: "tr-TR",
      timezone: "Europe/Istanbul",
      webhook_url: "https://recall.example/api/voice/retell/events",
      webhook_events: ["call_started", "call_ended", "call_analyzed"],
    });
    expect(agent.boosted_keywords).toEqual([
      "Diş Hekimi Can Demir",
      "Can Demir",
      "Diş Taşı Temizliği",
      "temizlik",
    ]);
  });

  it("exposes every domain tool as a custom function on our tools endpoint", () => {
    const { llm } = buildRetellAgentSpec(input());
    expect(toolNames({ llm, agent: {} as never })).toEqual([
      "check_availability",
      "find_appointments",
      "book_appointment",
      "cancel_appointment",
      "reschedule_appointment",
      "create_callback_request",
      "end_call",
    ]);

    const check = llm.general_tools?.find((tool) => tool.name === "check_availability");
    expect(check).toMatchObject({
      type: "custom",
      url: "https://recall.example/api/voice/retell/tools",
      method: "POST",
      speak_during_execution: true,
      execution_message_description: "Hemen takvime bakıyorum.",
      parameters: { type: "object", required: ["serviceId", "date"] },
    });
  });

  it("adds a transfer tool only when the clinic has a transfer number", () => {
    const spec = buildRetellAgentSpec(
      input({ clinic: { ...clinic, transferPhoneNumber: "+905550000000" } }),
    );
    expect(toolNames(spec)).toContain("transfer_call");
    expect(spec.llm.general_tools?.find((t) => t.name === "transfer_call")).toMatchObject({
      transfer_destination: { type: "predefined", number: "+905550000000" },
      transfer_option: { type: "cold_transfer" },
    });
  });

  it("uses Retell's clock and caller variables plus defaults for ours", () => {
    const { llm } = buildRetellAgentSpec(input());
    expect(llm.general_prompt).toContain("{{current_time_Europe/Istanbul}}");
    expect(llm.general_prompt).toContain("{{current_calendar_Europe/Istanbul}}");
    expect(llm.general_prompt).toContain("{{user_number}}");
    expect(llm.general_prompt).toContain("{{clinic_status}}");
    expect(llm.default_dynamic_variables).toEqual({
      transfer_available: "hayır",
      clinic_status: "active",
    });
    expect(llm.begin_message).toContain("Gülüş Diş Kliniği, merhaba! Ben Elif");
    expect(llm.model).toBe("claude-5-sonnet");
  });

  it("prefers the clinic's own voice and fails without any voice", () => {
    const settings = parseClinicSettings({ assistant: { voiceId: "clinic-voice" } });
    expect(buildRetellAgentSpec(input({ settings })).agent.voice_id).toBe("clinic-voice");
    expect(() => buildRetellAgentSpec(input({ defaultVoiceId: undefined }))).toThrow(
      /No voice configured/,
    );
  });
});

describe("voice and analysis settings", () => {
  it("sets the TTS model only when configured", () => {
    expect(buildRetellAgentSpec(input()).agent).not.toHaveProperty("voice_model");
    expect(
      buildRetellAgentSpec(input({ voiceModel: "eleven_multilingual_v2" })).agent.voice_model,
    ).toBe("eleven_multilingual_v2");
  });

  it("asks for a minimal Turkish call summary", () => {
    const [summary] = buildRetellAgentSpec(input()).agent.post_call_analysis_data ?? [];
    expect(summary).toMatchObject({ type: "system-presets", name: "call_summary" });
    expect(summary?.description).toContain("Türkçe");
    expect(summary?.description).toContain("telefon numarası");
  });
});

describe("specHash", () => {
  it("is stable for equal specs and changes with the configuration", () => {
    const a = specHash(buildRetellAgentSpec(input()));
    expect(specHash(buildRetellAgentSpec(input()))).toBe(a);
    expect(specHash(buildRetellAgentSpec(input({ llmModel: "claude-4.5-haiku" })))).not.toBe(a);
  });
});
