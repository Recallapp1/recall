import type Retell from "retell-sdk";
import { describe, expect, it } from "vitest";

import { compatibleProvider, toAssistantVoices } from "./voices";

const voice = (overrides: Partial<Retell.VoiceResponse>): Retell.VoiceResponse => ({
  voice_id: "11labs-Anna",
  voice_name: "Anna",
  provider: "elevenlabs",
  gender: "female",
  ...overrides,
});

describe("compatibleProvider", () => {
  it("ties ElevenLabs models to ElevenLabs voices", () => {
    expect(compatibleProvider("eleven_flash_v2_5")).toBe("elevenlabs");
    expect(compatibleProvider("eleven_multilingual_v2")).toBe("elevenlabs");
  });

  it("does not filter without a model", () => {
    expect(compatibleProvider(undefined)).toBeNull();
  });
});

describe("toAssistantVoices", () => {
  it("keeps only the model's provider, drops locale tags, sorts by name", () => {
    const voices = toAssistantVoices(
      [
        voice({ voice_id: "11labs-Zuri", voice_name: "Zuri" }),
        voice({ voice_id: "11labs-Amy", voice_name: "Amy(UK)" }),
        voice({ voice_id: "11labs-Zuri-Spanish-localized", voice_name: "Zuri" }),
        voice({ voice_id: "openai-Alloy", voice_name: "Alloy", provider: "openai" }),
        voice({
          voice_id: "11labs-Monika",
          voice_name: "Monika (en-IN)",
          preview_audio_url: "https://x/m.mp3",
        }),
      ],
      "elevenlabs",
    );
    expect(voices).toEqual([
      { id: "11labs-Amy", name: "Amy", gender: "female", previewUrl: null },
      { id: "11labs-Monika", name: "Monika", gender: "female", previewUrl: "https://x/m.mp3" },
      { id: "11labs-Zuri", name: "Zuri", gender: "female", previewUrl: null },
    ]);
  });
});
