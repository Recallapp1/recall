import { describe, expect, it } from "vitest";

import type { Database } from "../../../db";
import type { Clinic } from "../../../db/schema";
import { parseClinicSettings } from "../../../domain/clinic-settings";
import { buildVapiAssistant, type BuildAssistantInput } from "./assistant";
import { isAuthorizedVapiRequest } from "./auth";
import { handleVapiRequest, type VapiHandlerDeps } from "./handler";

const SECRET = "test-secret-0123456789";

const clinic: Clinic = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "gulus-dis",
  name: "Gülüş Diş Kliniği",
  timezone: "Europe/Istanbul",
  phoneNumber: "+902120000000",
  transferPhoneNumber: "+905550000000",
  address: null,
  settings: {},
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const clinicHours = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startTime: "09:00:00",
  endTime: "18:00:00",
}));
const MONDAY_NOON_UTC = new Date("2026-10-05T09:00:00Z"); // 12:00 in Istanbul
const SUNDAY_NOON_UTC = new Date("2026-10-04T09:00:00Z");

function assistantInput(overrides: Partial<BuildAssistantInput> = {}): BuildAssistantInput {
  return {
    clinic,
    settings: parseClinicSettings({ assistant: { name: "Elif" } }),
    directory: { clinicHours, practitioners: [], services: [] },
    callerPhone: "+905321234567",
    now: MONDAY_NOON_UTC,
    serverUrl: "https://recall.test/api/voice/vapi",
    serverSecret: SECRET,
    pipeline: {
      llmModel: "claude-opus-5-5",
      transcriberProvider: "deepgram",
      transcriberModel: "nova-2",
      ttsProvider: "azure",
      ttsVoiceId: "tr-TR-EmelNeural",
    },
    ...overrides,
  };
}

const toolNames = (assistant: ReturnType<typeof buildVapiAssistant>) =>
  assistant.model.tools.map((tool) => ("function" in tool ? tool.function.name : tool.type));

describe("buildVapiAssistant", () => {
  it("exposes every function tool with JSON schema parameters", () => {
    const assistant = buildVapiAssistant(assistantInput());
    expect(toolNames(assistant)).toEqual([
      "check_availability",
      "find_appointments",
      "book_appointment",
      "cancel_appointment",
      "reschedule_appointment",
      "create_callback_request",
      "endCall",
      "transferCall",
    ]);

    const check = assistant.model.tools.find(
      (tool) => "function" in tool && tool.function.name === "check_availability",
    );
    expect(check && "function" in check && check.function.parameters).toMatchObject({
      type: "object",
      required: ["serviceId", "date"],
    });
  });

  it("only offers a transfer during clinic hours", () => {
    expect(toolNames(buildVapiAssistant(assistantInput({ now: SUNDAY_NOON_UTC })))).not.toContain(
      "transferCall",
    );
  });

  it("limits a paused clinic to callback requests", () => {
    const assistant = buildVapiAssistant(
      assistantInput({ clinic: { ...clinic, status: "paused" } }),
    );
    expect(toolNames(assistant)).toEqual(["create_callback_request", "endCall", "transferCall"]);
    expect(assistant.model.messages[0].content).toContain("yeni randevu almıyor");
  });

  it("configures Turkish transcription, the clinic voice and recording", () => {
    const settings = parseClinicSettings({
      assistant: { voiceId: "custom-voice", recordCalls: false },
    });
    const assistant = buildVapiAssistant(assistantInput({ settings }));
    expect(assistant.transcriber.language).toBe("tr");
    expect(assistant.voice.voiceId).toBe("custom-voice");
    expect(assistant.artifactPlan.recordingEnabled).toBe(false);
    expect(assistant.server).toEqual({ url: "https://recall.test/api/voice/vapi", secret: SECRET });
  });
});

describe("isAuthorizedVapiRequest", () => {
  it("accepts the x-vapi-secret header or a bearer token", () => {
    expect(isAuthorizedVapiRequest(new Headers({ "x-vapi-secret": SECRET }), SECRET)).toBe(true);
    expect(
      isAuthorizedVapiRequest(new Headers({ authorization: `Bearer ${SECRET}` }), SECRET),
    ).toBe(true);
  });

  it("rejects missing or wrong secrets", () => {
    expect(isAuthorizedVapiRequest(new Headers(), SECRET)).toBe(false);
    expect(isAuthorizedVapiRequest(new Headers({ "x-vapi-secret": "wrong" }), SECRET)).toBe(false);
  });
});

describe("handleVapiRequest", () => {
  const deps: VapiHandlerDeps = {
    // These cases are rejected before any query runs.
    db: {} as Database,
    secret: SECRET,
    serverUrl: "https://recall.test/api/voice/vapi",
    pipeline: assistantInput().pipeline,
    now: () => MONDAY_NOON_UTC,
    defer: () => {},
  };

  const post = (body: unknown, headers: Record<string, string> = { "x-vapi-secret": SECRET }) =>
    handleVapiRequest(
      new Request("https://recall.test/api/voice/vapi", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
      deps,
    );

  it("returns 401 for a bad secret", async () => {
    const response = await post(
      { message: { type: "status-update" } },
      { "x-vapi-secret": "nope" },
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for a malformed payload", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post({ nope: true })).status).toBe(400);
  });

  it("acknowledges informational messages", async () => {
    const response = await post({ message: { type: "status-update", status: "in-progress" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
  });
});
