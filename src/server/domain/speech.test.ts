import { describe, expect, it } from "vitest";

import { numberToWords, spokenPhone, spokenTitles, spokenTime } from "./speech";

describe("numberToWords", () => {
  it.each([
    [0, "sıfır"],
    [5, "beş"],
    [10, "on"],
    [14, "on dört"],
    [31, "otuz bir"],
    [100, "yüz"],
    [123, "yüz yirmi üç"],
    [532, "beş yüz otuz iki"],
    [1000, "bin"],
    [1475, "bin dört yüz yetmiş beş"],
    [2026, "iki bin yirmi altı"],
  ])("%i → %s", (n, words) => {
    expect(numberToWords(n)).toBe(words);
  });

  it("rejects numbers it cannot say", () => {
    expect(() => numberToWords(-1)).toThrow();
    expect(() => numberToWords(1.5)).toThrow();
  });
});

describe("spokenTime", () => {
  it.each([
    ["09:00", "dokuz"],
    ["10:30", "on otuz"],
    ["14:45", "on dört kırk beş"],
    ["10:05", "on sıfır beş"],
  ])("%s → %s", (time, words) => {
    expect(spokenTime(time)).toBe(words);
  });
});

describe("spokenPhone", () => {
  it("reads Turkish numbers in dictation groups", () => {
    expect(spokenPhone("+905321234567")).toBe(
      "sıfır beş yüz otuz iki, yüz yirmi üç, kırk beş, altmış yedi",
    );
  });

  it("reads a leading zero inside a group on its own", () => {
    expect(spokenPhone("+905321230507")).toBe(
      "sıfır beş yüz otuz iki, yüz yirmi üç, sıfır beş, sıfır yedi",
    );
  });

  it("falls back to digit by digit for other countries", () => {
    expect(spokenPhone("+1415")).toBe("bir dört bir beş");
  });
});

describe("spokenTitles", () => {
  it("expands the dentist abbreviation in any spelling", () => {
    expect(spokenTitles("Dt. Elif Kaya")).toBe("Diş Hekimi Elif Kaya");
    expect(spokenTitles("DT Elif Kaya")).toBe("Diş Hekimi Elif Kaya");
    expect(spokenTitles("dt.Elif")).toBe("Diş Hekimi Elif");
  });

  it("expands stacked academic and specialist titles", () => {
    expect(spokenTitles("Uzm. Dt. Can Demir")).toBe("Uzman Diş Hekimi Can Demir");
    expect(spokenTitles("Prof. Dr. Ayşe Yılmaz")).toBe("Profesör Doktor Ayşe Yılmaz");
    expect(spokenTitles("Dr. Öğr. Üyesi Mert Ak")).toBe("Doktor Öğretim Üyesi Mert Ak");
    expect(spokenTitles("Fzt. Selin Aydın")).toBe("Fizyoterapist Selin Aydın");
  });

  it("leaves ordinary words alone", () => {
    expect(spokenTitles("Diş taşı temizliği")).toBe("Diş taşı temizliği");
    expect(spokenTitles("Operasyon sonrası kontrol")).toBe("Operasyon sonrası kontrol");
    expect(spokenTitles("Ahmet Drama")).toBe("Ahmet Drama");
  });
});
