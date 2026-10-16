import { describe, expect, it } from "vitest";

import { medicalFlags, unbackedClaims, type CallFacts } from "./call-flags";

/*
 * R2 4d: everyday Turkish, speech-recognition slips, misses and false
 * positives for the post-call flags (POST_CALL_FLAGS, off by default).
 * Every sentence is invented.
 */

const caller = (line: string) => ({ transcript: `Agent: Buyurun\nUser: ${line}`, summary: null });
const agent = (line: string) => ({ transcript: `User: Tamam\nAgent: ${line}`, summary: null });
const NOTHING: CallFacts = { booked: false, cancelled: false, rescheduled: false };

describe("emergencies the caller describes", () => {
  it.each([
    "göğsümde bir ağrı var, sıkışıyor",
    "kalbim sıkışıyor, kolum uyuşuyor",
    "nefesim kesiliyor",
    "boğazım şişiyor, nefes alamıyorum",
    "diş çekildi, kan durmuyor",
    "annem bayıldı, şimdi ne yapalım",
    "kendime zarar vereceğim",
    "ölmek istiyorum",
    "nefes alamıyom",
  ])("%s", (line) => {
    expect(medicalFlags(caller(line))).toEqual(["emergency"]);
  });

  it("the assistant telling the caller to dial 112, also when the transcript spells it out", () => {
    expect(medicalFlags(agent("Lütfen hemen 112'yi arayın."))).toEqual(["emergency"]);
    expect(medicalFlags(agent("Lütfen hemen yüz on ikiyi arayın."))).toEqual(["emergency"]);
  });
});

describe("medical risk", () => {
  it.each([
    "yüzümde şişlik var",
    "ateşim var, dün akşamdan beri",
    "yüksek ateş çıktı",
    "dişetimde iltihap var",
    "apse oldu galiba",
    "hamileyim, ilaç alabilir miyim",
    "coumadin kullanıyorum",
    "kan sulandırıcı içiyorum",
  ])("%s", (line) => {
    expect(medicalFlags(caller(line))).toEqual(["medical_risk"]);
  });
});

describe("no flag (false positives)", () => {
  it.each([
    "kanal tedavisi için randevu istiyorum",
    "nefes kokusu için bir şey var mı",
    "muayene 112 lira mı",
    "Doktor Ateş var mı bugün",
    "İrina Hanım için randevu",
    "bayıldım bu kliniğe, çok memnunum",
    "bir şişe su getirebilir miyim",
    "dişim ağrıyor, kontrol istiyorum",
  ])("%s", (line) => {
    expect(medicalFlags(caller(line))).toEqual([]);
  });
});

describe("unbacked booking claims", () => {
  it.each([
    ["Randevunuz oluşturuldu.", "booked"],
    ["Randevunuzu oluşturdum, görüşmek üzere.", "booked"],
    ["Randevunuz alınmıştır.", "booked"],
    ["Randevunuzu iptal ettim.", "cancelled"],
    ["Randevunuz iptal edilmiştir.", "cancelled"],
    ["Randevunuzu perşembeye taşıdım.", "rescheduled"],
  ] as const)("%s", (line, fact) => {
    expect(unbackedClaims(agent(line), NOTHING)).toEqual([fact]);
  });

  it.each([
    "Randevunuz oluşturuldu mu diye kontrol ediyorum.",
    "Randevunuz oluşturulamadı, başka bir saat deneyelim.",
    "Randevunuzu oluşturmamı ister misiniz?",
    "Randevunuzu iptal etmemi ister misiniz?",
  ])("not a claim: %s", (line) => {
    expect(unbackedClaims(agent(line), NOTHING)).toEqual([]);
  });

  it("a claim backed by the records is fine", () => {
    expect(unbackedClaims(agent("Randevunuzu oluşturdum."), { ...NOTHING, booked: true })).toEqual(
      [],
    );
  });
});

/*
 * C5 (VOICE_EMERGENCY_FIRST): the prompt's emergency list now names allergic
 * reactions, self-harm and overdose. The post-call flag must catch the
 * caller's own words for them, so a call where the assistant missed the rule
 * is still flagged; routine mentions of allergies or painkillers must not be.
 */
describe("C5 symptoms in the caller's own words", () => {
  it.each([
    "bir ilaca alerjim tuttu",
    "alerjim tuttu, ne yapacağımı bilmiyorum",
    "antibiyotik alerji yaptı, kaşıntı başladı",
    "alerjik tepki verdim galiba",
    "dudaklarım şişiyor",
    "dilim şişti, konuşamıyorum",
    "boğazım şişmeye başladı",
    "çok fazla ağrı kesici içtim",
    "fazla hap yuttum",
    "bir kutu ilaç içti",
    "oğlum kendine zarar verdi",
    "annem için arıyorum, bayıldı",
  ])("%s", (line) => {
    expect(medicalFlags(caller(line))).toEqual(["emergency"]);
  });
});

describe("C5 false alarms: routine allergy and painkiller mentions", () => {
  it.each([
    "penisiline alerjim var, randevu istiyorum",
    "polen alerjim var, kontrol için arıyorum",
    "alerji ilacı kullanıyorum, sorun olur mu",
    "ağrı kesici aldım ama geçmedi, randevu istiyorum",
    "dişim hafif ağrıyor",
    "dudak dolgusu için randevu almak istiyorum",
    "dudağımda uçuk var",
  ])("%s", (line) => {
    expect(medicalFlags(caller(line))).not.toContain("emergency");
  });
});
