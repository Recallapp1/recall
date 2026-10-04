import { describe, expect, it } from "vitest";

import { parseClinicSettings } from "../domain/clinic-settings";
import {
  buildCallVariables,
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

const clinic = {
  name: "Gülüş Diş Kliniği",
  address: "Moda Cad. No:1 Kadıköy",
  timezone: "Europe/Istanbul",
  transferPhoneNumber: null as string | null,
};

function promptInput(overrides: Partial<PromptInput> = {}): PromptInput {
  return {
    clinic,
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
    placeholders: {
      now: "<NOW>",
      calendar: "<CAL>",
      callerPhone: "<CALLER>",
      transferAvailable: "<TRANSFER>",
      clinicStatus: "<STATUS>",
    },
    toolNames: { endCall: "end_call", transferCall: "transfer_call" },
    ...overrides,
  };
}

describe("buildSystemPrompt", () => {
  it("includes the clinic identity and directory with ids", () => {
    const prompt = buildSystemPrompt(promptInput());
    expect(prompt).toContain("Sen Gülüş Diş Kliniği için çalışan telefon asistanısın. Adın Elif.");
    expect(prompt).toContain("- Dt. Can Demir (id: p-1)");
    expect(prompt).toContain("Diş Taşı Temizliği [temizlik, detertraj]: 30 dk (id: s-1)");
    expect(prompt).toContain("- Pazartesi: 09:00-18:00");
    expect(prompt).toContain("- Pazar: kapalı");
  });

  it("references call-time values only through placeholders", () => {
    const prompt = buildSystemPrompt(promptInput());
    expect(prompt).toContain("Şu an: <NOW> (saat dilimi Europe/Istanbul)");
    expect(prompt).toContain("<CAL>");
    expect(prompt).toContain('Arayan numara: "<CALLER>"');
    expect(prompt).toContain('Klinik durumu: "<STATUS>"');
  });

  it("is identical for every call, so it can be synced ahead of time", () => {
    expect(buildSystemPrompt(promptInput())).toBe(buildSystemPrompt(promptInput()));
  });

  it("does not guess gendered titles from names", () => {
    expect(buildSystemPrompt(promptInput())).toContain('"Bey" veya "Hanım" ekleme');
  });

  it("hides prices unless the clinic allows them", () => {
    expect(buildSystemPrompt(promptInput())).not.toContain("TL");

    const settings = parseClinicSettings({ assistant: { speakPrices: true } });
    expect(buildSystemPrompt(promptInput({ settings }))).toContain("1.500 TL ile 2.500 TL arası");
  });

  it("offers transfer only when the clinic has a transfer number, gated by availability", () => {
    expect(buildSystemPrompt(promptInput())).not.toContain("transfer_call");

    const withTransfer = buildSystemPrompt(
      promptInput({ clinic: { ...clinic, transferPhoneNumber: "+905550000000" } }),
    );
    expect(withTransfer).toContain(
      '"<TRANSFER>" değeri "evet" ise transfer_call ile kliniğe aktar',
    );
  });

  it("always keeps the safety rules and appends clinic instructions", () => {
    const settings = parseClinicSettings({
      assistant: { extraInstructions: "İmplant için muayene öner." },
    });
    const prompt = buildSystemPrompt(promptInput({ settings }));
    expect(prompt).toContain("Tıbbi tavsiye");
    expect(prompt).toContain("112");
    expect(prompt).toContain("end_call");
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

describe("buildCallVariables", () => {
  const MONDAY_NOON = new Date("2026-10-05T09:00:00Z"); // 12:00 Istanbul
  const SUNDAY_NOON = new Date("2026-10-04T09:00:00Z");
  const base = { status: "active" as const, timezone: "Europe/Istanbul" };

  it("allows transfer only with a number and during clinic hours", () => {
    const withNumber = { ...base, transferPhoneNumber: "+905550000000" };
    expect(buildCallVariables(withNumber, clinicHours, MONDAY_NOON).transfer_available).toBe(
      "evet",
    );
    expect(buildCallVariables(withNumber, clinicHours, SUNDAY_NOON).transfer_available).toBe(
      "hayır",
    );
    expect(
      buildCallVariables({ ...base, transferPhoneNumber: null }, clinicHours, MONDAY_NOON)
        .transfer_available,
    ).toBe("hayır");
  });

  it("passes the clinic status through", () => {
    const paused = { ...base, status: "paused" as const, transferPhoneNumber: null };
    expect(buildCallVariables(paused, clinicHours, MONDAY_NOON).clinic_status).toBe("paused");
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
