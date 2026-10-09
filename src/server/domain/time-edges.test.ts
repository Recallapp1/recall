import { describe, expect, it } from "vitest";

import { personName } from "@/lib/names";
import { normalizePhone } from "@/lib/phone";

import { sameFullName } from "./appointments";
import { localToUtc, localToday, utcToLocal } from "./time";

/* Turkish date, time, name and phone edges (audit A10). */

describe("time zones", () => {
  it("keeps Istanbul at UTC+3 all year (no DST since 2016)", () => {
    expect(localToUtc("2026-01-15", 10 * 60, "Europe/Istanbul").toISOString()).toBe(
      "2026-01-15T07:00:00.000Z",
    );
    expect(localToUtc("2026-07-15", 10 * 60, "Europe/Istanbul").toISOString()).toBe(
      "2026-07-15T07:00:00.000Z",
    );
  });

  it("follows DST for a clinic in a zone that has it", () => {
    expect(localToUtc("2026-03-28", 10 * 60, "Europe/Berlin").toISOString()).toBe(
      "2026-03-28T09:00:00.000Z",
    );
    expect(localToUtc("2026-03-30", 10 * 60, "Europe/Berlin").toISOString()).toBe(
      "2026-03-30T08:00:00.000Z",
    );
  });

  it("puts 21:00 UTC on the next local day in Istanbul (midnight boundary)", () => {
    expect(utcToLocal(new Date("2026-10-04T21:00:00Z"), "Europe/Istanbul")).toEqual({
      date: "2026-10-05",
      time: "00:00",
    });
    expect(localToday(new Date("2026-10-04T20:59:59Z"), "Europe/Istanbul")).toBe("2026-10-04");
  });
});

describe("Turkish names", () => {
  it("capitalises dotted and dotless i correctly", () => {
    expect(personName("ismail ışık")).toBe("İsmail Işık");
    expect(personName("İSMAİL IŞIK")).toBe("İsmail Işık");
  });

  it("matches names across case and Turkish letters", () => {
    expect(sameFullName("İsmail Işık", "ISMAIL ISIK")).toBe(true);
    expect(sameFullName("Şule Çağ", "sule cag")).toBe(true);
    expect(sameFullName("Ali Er", "Ali Eren Er")).toBe(false);
  });
});

describe("phone numbers", () => {
  it("accepts the common Turkish spellings and rejects short ones", () => {
    for (const input of ["0532 000 00 25", "+90 532 000 00 25", "90 532 000 00 25", "5320000025"]) {
      expect(normalizePhone(input), input).toBe("+905320000025");
    }
    expect(normalizePhone("0532 000 00 2")).toBeNull();
    expect(normalizePhone("anonymous")).toBeNull();
  });
});
