import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseClinicSettings } from "../domain/clinic-settings";
import { buildSystemPrompt, type PromptInput } from "./prompt";

/*
 * VOICE_NO_NAME_ADDRESS (19 Oct eval, no-gendered-titles): the "# Hitap"
 * example allowed addressing the caller by the name they gave, and in Turkish
 * a first name invites "Bey"/"Hanım" ("Mükemmel, Mehmet Bey."). On: no
 * address by name at all, the name only read back to confirm it. Off: every
 * prompt stays byte-identical, so live agents keep their spec.
 */

const TRANSFER = "+902120000000";

function input(
  options: {
    variant?: "full" | "compact";
    transfer?: boolean;
    hardening?: boolean;
    notes?: boolean;
    noNameAddress?: boolean;
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
    ...(options.noNameAddress !== undefined && { noNameAddress: options.noNameAddress }),
  } as PromptInput;
}

const hash = (prompt: string) => createHash("sha256").update(prompt).digest("hex").slice(0, 16);

/** SHA-256 (first 16 hex) of every prompt combination, taken before VOICE_NO_NAME_ADDRESS existed (all switches off). */
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

describe("VOICE_NO_NAME_ADDRESS off: today's prompt, byte for byte", () => {
  it.each(combinations)(
    "$key is unchanged when the switch is unset or false",
    ({ key, options }) => {
      expect(hash(buildSystemPrompt(input(options)))).toBe(BEFORE[key]);
      expect(hash(buildSystemPrompt(input({ ...options, noNameAddress: false })))).toBe(
        BEFORE[key],
      );
    },
  );
});

describe.each(["full", "compact"] as const)("VOICE_NO_NAME_ADDRESS on (%s)", (variant) => {
  const sections = (prompt: string) => prompt.split("\n\n");
  const address = (prompt: string) =>
    sections(prompt).find((section) => section.startsWith("# Hitap"))!;
  const on = () => buildSystemPrompt(input({ variant, noNameAddress: true, notes: true }));
  const off = () => buildSystemPrompt(input({ variant, notes: true }));

  it("forbids addressing the caller by name and Bey/Hanım", () => {
    const rules = address(on());
    expect(rules).toMatch(/Hastaya adıyla hitap etme/);
    expect(rules).toMatch(/"Bey" veya "Hanım" kullanma/);
    expect(rules).toMatch(/İsimden cinsiyet tahmin etme/);
  });

  it("keeps the name only for reading it back to confirm", () => {
    expect(address(on())).toMatch(/yalnızca[^\n]*teyit/);
  });

  it("drops the example that allowed the caller's own name", () => {
    // Only the full prompt carries the example; the compact one never had it.
    if (variant === "full") expect(off()).toContain("hastanın kendi söylediği ad ve soyadıyla");
    expect(on()).not.toContain("kendi söylediği ad");
    expect(on()).not.toMatch(/Doğru: "[^"]*<ad>/);
  });

  it("changes only the address section", () => {
    const before = sections(off()).filter((s) => !s.startsWith("# Hitap"));
    const after = sections(on()).filter((s) => !s.startsWith("# Hitap"));
    expect(after).toEqual(before);
  });
});

describe("VOICE_NO_NAME_ADDRESS with the hardened prompt", () => {
  it.each(combinations.filter((c) => c.options.hardening))(
    "$key: ignored, like the other prompt switches (hardening has its own address rule)",
    ({ key, options }) => {
      expect(hash(buildSystemPrompt(input({ ...options, noNameAddress: true })))).toBe(BEFORE[key]);
    },
  );
});
