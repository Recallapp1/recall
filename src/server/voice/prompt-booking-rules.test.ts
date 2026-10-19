import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseClinicSettings } from "../domain/clinic-settings";
import { buildSystemPrompt, type PromptInput } from "./prompt";

/*
 * VOICE_BOOKING_RULES (19 Oct eval): two booking rules. A weekday the
 * assistant did not hear clearly ("asılı" for "Salı") is asked, not guessed;
 * a booking waits until the phone number has been read back and confirmed
 * (book-clear booked straight after hearing it). Off: every prompt stays
 * byte-identical, so live agents keep their spec.
 */

const TRANSFER = "+902120000000";

function input(
  options: {
    variant?: "full" | "compact";
    transfer?: boolean;
    hardening?: boolean;
    notes?: boolean;
    bookingRules?: boolean;
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
    ...(options.bookingRules !== undefined && { bookingRules: options.bookingRules }),
  } as PromptInput;
}

const hash = (prompt: string) => createHash("sha256").update(prompt).digest("hex").slice(0, 16);

/** SHA-256 (first 16 hex) of every prompt combination, taken before VOICE_BOOKING_RULES existed (all switches off). */
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

describe("VOICE_BOOKING_RULES off: today's prompt, byte for byte", () => {
  it.each(combinations)(
    "$key is unchanged when the switch is unset or false",
    ({ key, options }) => {
      expect(hash(buildSystemPrompt(input(options)))).toBe(BEFORE[key]);
      expect(hash(buildSystemPrompt(input({ ...options, bookingRules: false })))).toBe(BEFORE[key]);
    },
  );
});

describe.each(["full", "compact"] as const)("VOICE_BOOKING_RULES on (%s)", (variant) => {
  const howTo = (prompt: string) =>
    prompt.split("\n\n").find((section) => section.startsWith("# Nasıl çalışırsın"))!;
  const on = (options: { transfer?: boolean; notes?: boolean } = {}) =>
    buildSystemPrompt(input({ variant, bookingRules: true, ...options }));

  it("asks for a weekday it did not hear clearly instead of guessing", () => {
    expect(howTo(on())).toMatch(/gün adını net duymadıysan[^\n]*tahmin etme[^\n]*sor/i);
  });

  it("reads the phone number back and waits for a yes before booking", () => {
    const section = howTo(on());
    const rule = section
      .split("\n")
      .find((line) => line.includes("telefon numarasını") && line.includes("geri okuyup"))!;
    expect(rule).toMatch(/onayını almadan book_appointment çağırma/);
    // Caller ID with no other number spoken: nothing to read back.
    expect(rule).toMatch(/Arayan numara doluysa/);
    // Before the line that books on a yes.
    expect(section.indexOf(rule)).toBeLessThan(section.indexOf("bekletmeden book_appointment"));
  });

  it("only adds: every line of the prompt without the switch is still there", () => {
    const off = buildSystemPrompt(input({ variant, notes: true, transfer: true }));
    const withRules = on({ notes: true, transfer: true });
    for (const line of off.split("\n")) expect(withRules, line).toContain(line);
    expect(withRules.length).toBeGreaterThan(off.length);
  });
});

describe("VOICE_BOOKING_RULES with the hardened prompt", () => {
  it.each(combinations.filter((c) => c.options.hardening))(
    "$key: ignored, like the other prompt switches (hardening is measured on its own)",
    ({ key, options }) => {
      expect(hash(buildSystemPrompt(input({ ...options, bookingRules: true })))).toBe(BEFORE[key]);
    },
  );
});
