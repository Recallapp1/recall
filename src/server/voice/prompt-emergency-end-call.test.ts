import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseClinicSettings } from "../domain/clinic-settings";
import { buildSystemPrompt, type PromptInput } from "./prompt";

/*
 * VOICE_EMERGENCY_END_CALL (option A for clinics without a transfer): after
 * the emergency sentence the assistant ends the call, so the caller's phone is
 * free to dial 112 at once. It must not cut the caller off: if they keep
 * talking or ask something, it repeats the 112 sentence and ends the call only
 * once they are quiet or say goodbye. Off by default, and with it off every
 * prompt stays byte-identical.
 */

const CLOSE = '"Hemen arayabilmeniz için görüşmeyi kapatıyorum, geçmiş olsun."';

type Options = {
  variant: "full" | "compact";
  transfer: boolean;
  hardening: boolean;
  emergencyFirst: boolean;
  endCall?: boolean;
};

function input(options: Options): PromptInput {
  return {
    clinic: {
      name: "Gülüş Diş Kliniği",
      address: "Moda Cad. No:1 Kadıköy",
      timezone: "Europe/Istanbul",
      transferPhoneNumber: options.transfer ? "+902120000000" : null,
    },
    settings: parseClinicSettings({ assistant: { name: "Elif" } }),
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
    emergencyFirst: options.emergencyFirst,
    ...(options.endCall !== undefined && { emergencyEndCall: options.endCall }),
  } as PromptInput;
}

const hash = (prompt: string) => createHash("sha256").update(prompt).digest("hex").slice(0, 16);

/** SHA-256 (first 16 hex) of each combination, taken before VOICE_EMERGENCY_END_CALL existed. */
const BEFORE: Record<string, string> = {
  "full|none|base|inline": "60051c4cc728c6f3",
  "full|none|base|first": "5b82bcee19e0e397",
  "full|none|hard|inline": "e79635f140ed6c5c",
  "full|none|hard|first": "e79635f140ed6c5c",
  "full|transfer|base|inline": "30416b40d407fbe4",
  "full|transfer|base|first": "73c9ac2a0e64d947",
  "full|transfer|hard|inline": "d20b1679680bbc85",
  "full|transfer|hard|first": "d20b1679680bbc85",
  "compact|none|base|inline": "976325d335ec23a1",
  "compact|none|base|first": "779f620558f46a24",
  "compact|none|hard|inline": "0de0c35643137288",
  "compact|none|hard|first": "0de0c35643137288",
  "compact|transfer|base|inline": "89cae638f8465c98",
  "compact|transfer|base|first": "1f97621e3f045219",
  "compact|transfer|hard|inline": "c8fb7a2ebba1016e",
  "compact|transfer|hard|first": "c8fb7a2ebba1016e",
};

const combinations = Object.keys(BEFORE).map((key) => {
  const [variant, transfer, hardening, placement] = key.split("|");
  return {
    key,
    options: {
      variant: variant as "full" | "compact",
      transfer: transfer === "transfer",
      hardening: hardening === "hard",
      emergencyFirst: placement === "first",
    },
  };
});

/** The emergency rule, wherever it sits: its own section or the "Sınırlar" line. */
function emergencyRule(prompt: string): string {
  const first = prompt.split("\n\n")[0]!;
  if (first.startsWith("# Acil durum")) return first;
  return prompt.split("\n").find((line) => /112'yi aramasını söyle/.test(line)) ?? "";
}

describe("VOICE_EMERGENCY_END_CALL off: today's prompt, byte for byte", () => {
  it.each(combinations)(
    "$key is unchanged when the switch is unset or false",
    ({ key, options }) => {
      expect(hash(buildSystemPrompt(input(options)))).toBe(BEFORE[key]);
      expect(hash(buildSystemPrompt(input({ ...options, endCall: false })))).toBe(BEFORE[key]);
    },
  );
});

describe.each(["full", "compact"] as const)("VOICE_EMERGENCY_END_CALL on (%s)", (variant) => {
  describe.each([true, false])("emergency rule first: %s", (emergencyFirst) => {
    const on = (transfer: boolean) =>
      emergencyRule(
        buildSystemPrompt(
          input({ variant, transfer, hardening: false, emergencyFirst, endCall: true }),
        ),
      );

    it("without a transfer number: says the closing sentence and ends the call", () => {
      const rule = on(false);
      expect(rule).toContain(CLOSE);
      expect(rule).toContain("end_call");
      expect(rule).not.toContain("transfer_call");
    });

    it("with a transfer number: transfers when possible, otherwise closes", () => {
      const rule = on(true);
      expect(rule).toContain(
        '"<TRANSFER>" değeri "evet" ise ardından transfer_call ile kliniğe aktar',
      );
      expect(rule).toMatch(/değilse[^.]*Hemen arayabilmeniz için görüşmeyi kapatıyorum/);
    });

    it("does not cut the caller off: keeps listening while they talk, ends only when they stop or say goodbye", () => {
      const rule = on(false);
      expect(rule).toContain("konuşmaya devam eder veya bir şey sorarsa kapatma");
      expect(rule).toContain("yalnızca 112'yi hemen araması gerektiğini kısaca tekrarla");
      expect(rule).toContain("arayan sustuğunda veya vedalaştığında");
      // The close comes after the 112 sentence, never instead of it.
      expect(rule.indexOf("Hemen arayabilmeniz")).toBeGreaterThan(
        rule.search(/yüz on ikiyi|112'yi/),
      );
    });
  });
});

describe("VOICE_EMERGENCY_END_CALL with the hardened prompt", () => {
  it.each(combinations.filter((c) => c.options.hardening))(
    "$key: the hardened prompt stays unchanged",
    ({ key, options }) => {
      expect(hash(buildSystemPrompt(input({ ...options, endCall: true })))).toBe(BEFORE[key]);
    },
  );
});
