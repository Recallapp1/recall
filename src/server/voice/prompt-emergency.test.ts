import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseClinicSettings } from "../domain/clinic-settings";
import { buildSystemPrompt, type PromptInput } from "./prompt";

/*
 * VOICE_EMERGENCY_FIRST: the emergency rule alone, taken from the hardened
 * prompt (A9) into the baseline: the exact sentence in words, the longer
 * symptom list, and the rule first in the prompt. Off by default, and with it
 * off every prompt must stay byte-identical, so live agents keep their spec.
 */

const SENTENCE = '"Lütfen hemen yüz on ikiyi arayın."';
const TRANSFER = "+902120000000";

function input(
  options: {
    variant?: "full" | "compact";
    transfer?: boolean;
    hardening?: boolean;
    notes?: boolean;
    emergencyFirst?: boolean;
  } = {},
): PromptInput {
  return {
    clinic: {
      name: "Gülüş Diş Kliniği",
      address: "Moda Cad. No:1 Kadıköy",
      timezone: "Europe/Istanbul",
      transferPhoneNumber: options.transfer ? TRANSFER : null,
    },
    settings: parseClinicSettings({
      assistant: options.notes
        ? {
            name: "Elif",
            greeting: "Merhaba",
            extraInstructions: "Kısa konuş.",
            faq: [{ q: "Otopark var mı?", a: "Evet." }],
          }
        : { name: "Elif" },
    }),
    directory: {
      clinicHours: [1, 2, 3, 4, 5].map((weekday) => ({
        weekday,
        startTime: "09:00:00",
        endTime: "18:00:00",
      })),
      practitioners: [{ id: "p-1", name: "Can Demir", title: "Dt." }],
      services: [
        {
          id: "s-1",
          name: "Diş Taşı Temizliği",
          aliases: ["temizlik"],
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
    variant: options.variant ?? "full",
    hardening: options.hardening ?? false,
    ...(options.emergencyFirst !== undefined && { emergencyFirst: options.emergencyFirst }),
  } as PromptInput;
}

const hash = (prompt: string) => createHash("sha256").update(prompt).digest("hex").slice(0, 16);

/** SHA-256 (first 16 hex) of every prompt combination, taken before VOICE_EMERGENCY_FIRST existed. */
const BEFORE: Record<string, string> = {
  "full|none|base|plain": "60051c4cc728c6f3",
  "full|none|base|notes": "c4f2f80bfdd996e6",
  "full|none|hard|plain": "e79635f140ed6c5c",
  "full|none|hard|notes": "1e9ccc6cac821c32",
  "full|transfer|base|plain": "30416b40d407fbe4",
  "full|transfer|base|notes": "50e6cfc7c1985325",
  "full|transfer|hard|plain": "d20b1679680bbc85",
  "full|transfer|hard|notes": "9e51172a1eba6b65",
  "compact|none|base|plain": "976325d335ec23a1",
  "compact|none|base|notes": "ac76380c4916addf",
  "compact|none|hard|plain": "0de0c35643137288",
  "compact|none|hard|notes": "4b29e1df7c97f8da",
  "compact|transfer|base|plain": "89cae638f8465c98",
  "compact|transfer|base|notes": "01fca2783db06096",
  "compact|transfer|hard|plain": "c8fb7a2ebba1016e",
  "compact|transfer|hard|notes": "614114808d6048ca",
};

const combinations = Object.keys(BEFORE).map((key) => {
  const [variant, transfer, hardening, notes] = key.split("|");
  return {
    key,
    options: {
      variant: variant as "full" | "compact",
      transfer: transfer === "transfer",
      hardening: hardening === "hard",
      notes: notes === "notes",
    },
  };
});

describe("VOICE_EMERGENCY_FIRST off: today's prompt, byte for byte", () => {
  it.each(combinations)(
    "$key is unchanged when the switch is unset or false",
    ({ key, options }) => {
      expect(hash(buildSystemPrompt(input(options)))).toBe(BEFORE[key]);
      expect(hash(buildSystemPrompt(input({ ...options, emergencyFirst: false })))).toBe(
        BEFORE[key],
      );
    },
  );
});

describe.each(["full", "compact"] as const)("VOICE_EMERGENCY_FIRST on (%s)", (variant) => {
  const on = (options: { transfer?: boolean; notes?: boolean } = {}) =>
    buildSystemPrompt(input({ variant, emergencyFirst: true, ...options }));

  it("opens the prompt with the emergency rule, before anything else", () => {
    const prompt = on({ notes: true });
    expect(prompt.startsWith("# Acil durum")).toBe(true);
    expect(prompt.indexOf("# Acil durum")).toBeLessThan(prompt.indexOf("Sen Gülüş Diş Kliniği"));
  });

  it("says the exact sentence in words before anything else", () => {
    const prompt = on();
    expect(prompt).toContain(`başka hiçbir şey söylemeden önce tam olarak şunu söyle: ${SENTENCE}`);
  });

  it("names the longer symptom list, including the three new ones", () => {
    const rule = on().split("\n\n")[0]!;
    for (const symptom of [
      "göğüs ağrısı",
      "nefes darlığı",
      "durmayan kanama",
      "bilinç kaybı",
      "hızla artan şişlik",
      "alerjik tepki",
      "kendine zarar verme",
      "aşırı ilaç",
    ]) {
      expect(rule, symptom).toContain(symptom);
    }
  });

  it("moves the rule instead of repeating it: the digit version is gone", () => {
    const prompt = on({ transfer: true });
    expect(prompt).not.toContain("112'yi aramasını söyle");
    expect(prompt.match(/yüz on ikiyi/g)).toHaveLength(1);
  });

  it("transfers to the clinic afterwards only when the clinic has a transfer number", () => {
    expect(on({ transfer: true }).split("\n\n")[0]).toContain(
      '"<TRANSFER>" değeri "evet" ise ardından transfer_call ile kliniğe aktar',
    );
    expect(on().split("\n\n")[0]).not.toContain("transfer_call");
  });

  it("keeps every other rule", () => {
    const prompt = on({ notes: true });
    for (const phrase of [
      "Tıbbi tavsiye, teşhis veya ilaç önerisi verme",
      "Hizmeti asla tahmin etme",
      "asla rakam kullanma",
      'Arayan numara: "<CALLER>"',
      'Klinik durumu: "<STATUS>"',
      "end_call",
      "# Kliniğin notları",
    ]) {
      expect(prompt, phrase).toContain(phrase);
    }
  });
});

describe("VOICE_EMERGENCY_FIRST with the hardened prompt", () => {
  it.each(combinations.filter((c) => c.options.hardening))(
    "$key: the hardened prompt already carries the rule and stays unchanged",
    ({ key, options }) => {
      expect(hash(buildSystemPrompt(input({ ...options, emergencyFirst: true })))).toBe(
        BEFORE[key],
      );
    },
  );
});
