import { describe, expect, it } from "vitest";

import { callFlags, medicalFlags, unbackedClaims, type CallFacts } from "./call-flags";

const NOTHING: CallFacts = { booked: false, cancelled: false, rescheduled: false };
const call = (lines: string[], summary: string | null = null) => ({
  transcript: lines.join("\n"),
  summary,
});

describe("unbackedClaims", () => {
  it("flags a booking the assistant announced but never made", () => {
    const text = call([
      "User: Yarın on dörtte temizlik istiyorum.",
      "Agent: Randevunuz oluşturuldu, görüşmek üzere.",
    ]);
    expect(unbackedClaims(text, NOTHING)).toEqual(["booked"]);
    expect(unbackedClaims(text, { ...NOTHING, booked: true })).toEqual([]);
  });

  it("covers cancellations and moves, with Turkish letters folded", () => {
    expect(unbackedClaims(call(["Agent: Randevunuz İPTAL EDİLDİ."]), NOTHING)).toEqual([
      "cancelled",
    ]);
    expect(unbackedClaims(call(["Agent: Randevunuz güncellendi."]), NOTHING)).toEqual([
      "rescheduled",
    ]);
    // A move creates an appointment in the call: that backs "güncellendi".
    expect(
      unbackedClaims(call(["Agent: Randevunuz taşındı."]), { ...NOTHING, booked: true }),
    ).toEqual([]);
  });

  it("ignores the caller's words and questions", () => {
    expect(
      unbackedClaims(
        call(["User: Randevunuz oluşturuldu dediniz ama mesaj gelmedi.", "Agent: Kontrol edeyim."]),
        NOTHING,
      ),
    ).toEqual([]);
    expect(
      unbackedClaims(call(["Agent: Randevunuzu oluşturmamı ister misiniz?"]), NOTHING),
    ).toEqual([]);
  });
});

describe("medicalFlags", () => {
  const emergencies = [
    "Göğsüm çok ağrıyor, sol koluma vuruyor.",
    "Nefes alamıyorum.",
    "Dişimi çektirdim, kanama durmuyor.",
    "Annem bayıldı.",
    "İlaç aldıktan sonra dudaklarım şişti, alerjik reaksiyon galiba.",
    "Artık yaşamak istemiyorum.",
    "Çok fazla ilaç içtim.",
    "Kalp krizi geçiriyor olabilirim.",
  ];
  for (const sentence of emergencies) {
    it(`treats "${sentence}" as an emergency`, () => {
      expect(medicalFlags(call([`User: ${sentence}`]))).toEqual(["emergency"]);
    });
  }

  it("treats the assistant sending someone to 112 as an emergency", () => {
    expect(
      medicalFlags(call(["User: Çok kötüyüm.", "Agent: Lütfen hemen 112'yi arayın."])),
    ).toEqual(["emergency"]);
  });

  it("flags medical risk below emergency level", () => {
    expect(medicalFlags(call(["User: Diş etim kanıyor ve yanağım şişti."]))).toEqual([
      "medical_risk",
    ]);
    expect(medicalFlags(call(["User: Ateşim var, dişimde apse olabilir."]))).toEqual([
      "medical_risk",
    ]);
    expect(medicalFlags(call([], "Hasta hamile olduğunu belirtti."))).toEqual(["medical_risk"]);
  });

  it("does not flag routine dental vocabulary (false-positive fixtures)", () => {
    for (const sentence of [
      "Kanal tedavisi için randevu istiyorum.",
      "Nefes kokusu için kontrol yaptırmak istiyorum.",
      "Fiyat 112 lira mı?",
      "Kanepe gibi rahat koltuklarınız var mı?",
      "Ateş ettiğiniz için teşekkürler.",
      "Bayılırım böyle hizmete!",
    ]) {
      expect(medicalFlags(call([`User: ${sentence}`])), sentence).toEqual([]);
    }
  });
});

describe("callFlags", () => {
  it("combines checks in a stable order and returns nothing for a normal call", () => {
    expect(
      callFlags(call(["User: Nefes alamıyorum.", "Agent: Randevunuz oluşturuldu."]), NOTHING),
    ).toEqual(["unbacked_claim", "emergency"]);
    expect(
      callFlags(call(["User: Yarın temizlik.", "Agent: Randevunuz oluşturuldu."]), {
        ...NOTHING,
        booked: true,
      }),
    ).toEqual([]);
  });
});
