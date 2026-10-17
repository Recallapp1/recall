import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseClinicSettings } from "../domain/clinic-settings";
import { buildFirstMessage, buildSystemPrompt, type PromptInput } from "./prompt";

/*
 * VOICE_KVKK_NOTICE (A17, draft wording from docs/legal-drafts/
 * RECORDING-NOTICE-SCRIPT.md, pending the lawyer): the greeting says the
 * caller is talking to an AI assistant and points to the privacy notice; the
 * prompt answers "are you a person?" honestly and handles an objection to
 * recording. Off by default, and with it off the greeting and every prompt
 * stay byte-identical, so live agents keep their spec.
 */

const CLINIC = { name: "Gülüş Diş Kliniği" };
const OBJECTION =
  '"Anlıyorum. Görüşme kaydı hizmet kalitesi için yapılıyor. İsterseniz klinik ekibimiz sizi kayıtsız bir hattan geri arasın; bunun için yalnızca adınızı ve numaranızı alayım."';

const settings = (record: boolean, greeting?: string) =>
  parseClinicSettings({
    assistant: { name: "Elif", recordCalls: record, ...(greeting && { greeting }) },
  });

function input(options: {
  variant: "full" | "compact";
  transfer: boolean;
  hardening: boolean;
  record: boolean;
  notice?: boolean;
}): PromptInput {
  return {
    clinic: {
      name: CLINIC.name,
      address: "Moda Cad. No:1 Kadıköy",
      timezone: "Europe/Istanbul",
      transferPhoneNumber: options.transfer ? "+902120000000" : null,
    },
    settings: settings(options.record),
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
    variant: options.variant,
    hardening: options.hardening,
    ...(options.notice !== undefined && { kvkkNotice: options.notice }),
  } as PromptInput;
}

const hash = (prompt: string) => createHash("sha256").update(prompt).digest("hex").slice(0, 16);

/** SHA-256 (first 16 hex) of each prompt combination, taken before VOICE_KVKK_NOTICE existed. */
const BEFORE: Record<string, string> = {
  "full|none|base|rec": "60051c4cc728c6f3",
  "full|none|base|norec": "60051c4cc728c6f3",
  "full|none|hard|rec": "e79635f140ed6c5c",
  "full|none|hard|norec": "e79635f140ed6c5c",
  "full|transfer|base|rec": "30416b40d407fbe4",
  "full|transfer|base|norec": "30416b40d407fbe4",
  "full|transfer|hard|rec": "d20b1679680bbc85",
  "full|transfer|hard|norec": "d20b1679680bbc85",
  "compact|none|base|rec": "976325d335ec23a1",
  "compact|none|base|norec": "976325d335ec23a1",
  "compact|none|hard|rec": "0de0c35643137288",
  "compact|none|hard|norec": "0de0c35643137288",
  "compact|transfer|base|rec": "89cae638f8465c98",
  "compact|transfer|base|norec": "89cae638f8465c98",
  "compact|transfer|hard|rec": "c8fb7a2ebba1016e",
  "compact|transfer|hard|norec": "c8fb7a2ebba1016e",
};

const combinations = Object.keys(BEFORE).map((key) => {
  const [variant, transfer, hardening, record] = key.split("|");
  return {
    key,
    options: {
      variant: variant as "full" | "compact",
      transfer: transfer === "transfer",
      hardening: hardening === "hard",
      record: record === "rec",
    },
  };
});

describe("VOICE_KVKK_NOTICE off: today's greeting and prompt, byte for byte", () => {
  it.each([
    [
      true,
      undefined,
      "Gülüş Diş Kliniği, merhaba! Ben Elif, kliniğin dijital asistanıyım. Hizmet kalitesi için görüşmemiz kaydedilmektedir. Size nasıl yardımcı olabilirim?",
    ],
    [
      true,
      "Gülüş Diş Kliniği'ne hoş geldiniz.",
      "Gülüş Diş Kliniği'ne hoş geldiniz. Hizmet kalitesi için görüşmemiz kaydedilmektedir. Size nasıl yardımcı olabilirim?",
    ],
    [
      false,
      undefined,
      "Gülüş Diş Kliniği, merhaba! Ben Elif, kliniğin dijital asistanıyım. Size nasıl yardımcı olabilirim?",
    ],
    [
      false,
      "Gülüş Diş Kliniği'ne hoş geldiniz.",
      "Gülüş Diş Kliniği'ne hoş geldiniz. Size nasıl yardımcı olabilirim?",
    ],
  ] as const)("greeting (recording %s, custom %s)", (record, greeting, expected) => {
    expect(buildFirstMessage(CLINIC, settings(record, greeting))).toBe(expected);
    expect(buildFirstMessage(CLINIC, settings(record, greeting), { kvkkNotice: false })).toBe(
      expected,
    );
  });

  it.each(combinations)(
    "prompt $key is unchanged when the switch is unset or false",
    ({ key, options }) => {
      expect(hash(buildSystemPrompt(input(options)))).toBe(BEFORE[key]);
      expect(hash(buildSystemPrompt(input({ ...options, notice: false })))).toBe(BEFORE[key]);
    },
  );
});

describe("VOICE_KVKK_NOTICE on: greeting (draft wording)", () => {
  const on = (record: boolean, greeting?: string) =>
    buildFirstMessage(CLINIC, settings(record, greeting), { kvkkNotice: true });

  it("says it is an AI assistant and points to the notice, recording on", () => {
    expect(on(true)).toBe(
      "Gülüş Diş Kliniği, merhaba! Ben Elif, kliniğin yapay zekâ asistanıyım. Görüşmemiz hizmet kalitesi için kaydedilmektedir; kişisel verilerinizle ilgili bilgi kliniğimizin web sitesinde yer alıyor. Size nasıl yardımcı olabilirim?",
    );
  });

  it("recording off: no recording sentence, the notice stays", () => {
    expect(on(false)).toBe(
      "Gülüş Diş Kliniği, merhaba! Ben Elif, kliniğin yapay zekâ asistanıyım. Kişisel verilerinizle ilgili bilgi kliniğimizin web sitesinde yer alıyor. Size nasıl yardımcı olabilirim?",
    );
  });

  it("a clinic's own greeting gets the AI sentence, unless it already says so", () => {
    expect(on(true, "Gülüş Diş Kliniği'ne hoş geldiniz.")).toBe(
      "Gülüş Diş Kliniği'ne hoş geldiniz. Ben Elif, kliniğin yapay zekâ asistanıyım. Görüşmemiz hizmet kalitesi için kaydedilmektedir; kişisel verilerinizle ilgili bilgi kliniğimizin web sitesinde yer alıyor. Size nasıl yardımcı olabilirim?",
    );
    const own = "Merhaba, Gülüş'ün yapay zekâ asistanı Elif ben.";
    expect(on(false, own)).toBe(
      `${own} Kişisel verilerinizle ilgili bilgi kliniğimizin web sitesinde yer alıyor. Size nasıl yardımcı olabilirim?`,
    );
  });
});

describe.each(["full", "compact"] as const)("VOICE_KVKK_NOTICE on: prompt (%s)", (variant) => {
  const on = (record: boolean) =>
    buildSystemPrompt(input({ variant, transfer: false, hardening: false, record, notice: true }));

  it("answers honestly when asked whether it is a person", () => {
    expect(on(true)).toContain("yapay zekâ asistanı olduğunu açıkça söyle");
  });

  it("handles an objection to recording with the draft sentence, no booking data, a callback note", () => {
    const prompt = on(true);
    expect(prompt).toContain("görüşmenin kaydedilmesini istemezse");
    expect(prompt).toContain(OBJECTION);
    expect(prompt).toContain("randevu bilgisi isteme ve randevu işlemi yapma");
    expect(prompt).toContain('sebep "kayıt istemedi"');
  });

  it("has no objection rule when the clinic does not record calls", () => {
    expect(on(false)).not.toContain("görüşmenin kaydedilmesini istemezse");
    expect(on(false)).toContain("yapay zekâ asistanı olduğunu açıkça söyle");
  });
});

describe("VOICE_KVKK_NOTICE with the hardened prompt", () => {
  it.each(combinations.filter((c) => c.options.hardening))(
    "$key: the hardened prompt (own objection rule) stays unchanged",
    ({ key, options }) => {
      expect(hash(buildSystemPrompt(input({ ...options, notice: true })))).toBe(BEFORE[key]);
    },
  );
});
