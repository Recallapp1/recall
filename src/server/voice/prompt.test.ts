import { describe, expect, it } from "vitest";

import { parseClinicSettings } from "../domain/clinic-settings";
import {
  buildFirstMessage,
  buildSystemPrompt,
  isWithinClinicHours,
  type PromptInput,
} from "./prompt";

const clinicHours = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startTime: "09:00:00",
  endTime: "18:00:00",
}));

function promptInput(overrides: Partial<PromptInput> = {}): PromptInput {
  return {
    clinic: {
      name: "Gülüş Diş Kliniği",
      address: "Moda Cad. No:1 Kadıköy",
      timezone: "Europe/Istanbul",
    },
    settings: parseClinicSettings({ assistant: { name: "Elif" } }),
    directory: {
      clinicHours,
      practitioners: [{ id: "p-1", name: "Can Demir", title: "Dt." }],
      services: [
        {
          id: "s-1",
          name: "Diş Taşı Temizliği",
          aliases: ["temizlik", "detertraj"],
          durationMinutes: 30,
          priceMin: 150000,
          priceMax: 250000,
        },
      ],
    },
    callerPhone: "+905321234567",
    transferAvailable: false,
    now: new Date("2026-10-04T09:00:00Z"), // Sunday 12:00 in Istanbul
    ...overrides,
  };
}

describe("buildSystemPrompt", () => {
  it("includes the clinic, today's local date and the directory with ids", () => {
    const prompt = buildSystemPrompt(promptInput());
    expect(prompt).toContain("Sen Gülüş Diş Kliniği için çalışan telefon asistanısın. Adın Elif.");
    expect(prompt).toContain("4 Ekim 2026 Pazar, saat 12:00");
    expect(prompt).toContain("- Dt. Can Demir (id: p-1)");
    expect(prompt).toContain("Diş Taşı Temizliği [temizlik, detertraj]: 30 dk (id: s-1)");
    expect(prompt).toContain("- Pazartesi: 09:00-18:00");
    expect(prompt).toContain("- Pazar: kapalı");
  });

  it("hides prices unless the clinic allows them", () => {
    expect(buildSystemPrompt(promptInput())).not.toContain("TL");

    const settings = parseClinicSettings({ assistant: { speakPrices: true } });
    expect(buildSystemPrompt(promptInput({ settings }))).toContain("1.500 TL ile 2.500 TL arası");
  });

  it("routes humans to a transfer or a callback depending on availability", () => {
    expect(buildSystemPrompt(promptInput({ transferAvailable: true }))).toContain(
      "transferCall kullan",
    );
    expect(buildSystemPrompt(promptInput({ transferAvailable: false }))).toContain(
      "create_callback_request ile not bırak",
    );
  });

  it("asks for a phone number when caller ID is withheld", () => {
    expect(buildSystemPrompt(promptInput({ callerPhone: null }))).toContain("Arayan numara: gizli");
  });

  it("always keeps the safety rules", () => {
    const settings = parseClinicSettings({
      assistant: { extraInstructions: "İmplant için muayene öner." },
    });
    const prompt = buildSystemPrompt(promptInput({ settings }));
    expect(prompt).toContain("Tıbbi tavsiye");
    expect(prompt).toContain("112");
    expect(prompt).toContain("# Klinik özel talimatları\nİmplant için muayene öner.");
  });
});

describe("buildFirstMessage", () => {
  it("greets with the recording notice by default", () => {
    const message = buildFirstMessage({ name: "Gülüş Diş Kliniği" }, parseClinicSettings({}));
    expect(message).toBe(
      "Gülüş Diş Kliniği, merhaba! Ben Asistan, kliniğin dijital asistanıyım. Hizmet kalitesi için görüşmemiz kaydedilmektedir. Size nasıl yardımcı olabilirim?",
    );
  });

  it("uses a custom greeting and omits the notice when recording is off", () => {
    const settings = parseClinicSettings({
      assistant: { greeting: "Bella'ya hoş geldiniz!", recordCalls: false },
    });
    expect(buildFirstMessage({ name: "Bella" }, settings)).toBe(
      "Bella'ya hoş geldiniz! Size nasıl yardımcı olabilirim?",
    );
  });
});

describe("isWithinClinicHours", () => {
  it("checks the clinic's local time", () => {
    // Monday 2026-10-05 08:30 Istanbul = 05:30 UTC
    expect(
      isWithinClinicHours(clinicHours, new Date("2026-10-05T05:30:00Z"), "Europe/Istanbul"),
    ).toBe(false);
    expect(
      isWithinClinicHours(clinicHours, new Date("2026-10-05T06:00:00Z"), "Europe/Istanbul"),
    ).toBe(true);
    expect(
      isWithinClinicHours(clinicHours, new Date("2026-10-05T15:00:00Z"), "Europe/Istanbul"),
    ).toBe(false);
  });
});
