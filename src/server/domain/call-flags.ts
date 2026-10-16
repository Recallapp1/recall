import "server-only";

import type { CallFlag } from "@/lib/contracts/call";

/**
 * Post-call flags (audit F-03, F-04): deterministic checks on what was said in
 * a finished call, so the clinic team sees calls that need a human look. No
 * model is involved; the patterns are Turkish and tested with fixtures,
 * including phrases that must not match ("kanal tedavisi", "nefes kokusu").
 */

/** What actually happened in the call, from our own records. */
export interface CallFacts {
  /** An appointment was created by this call. */
  booked: boolean;
  /** An appointment of a patient linked to this call was cancelled during it. */
  cancelled: boolean;
  /** A booking and a cancellation together: the assistant moved an appointment. */
  rescheduled: boolean;
}

export interface CallText {
  transcript: string | null;
  summary: string | null;
}

/** Normalised for matching: Turkish lower case, accents folded, single spaces. */
function fold(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/** Retell transcripts are "Agent: …" / "User: …" lines. */
function speakerLines(transcript: string | null, speaker: "agent" | "user"): string {
  if (!transcript) return "";
  const prefix = speaker === "agent" ? /^\s*agent\s*:/i : /^\s*user\s*:/i;
  return transcript
    .split(/\r?\n/)
    .filter((line) => prefix.test(line))
    .map((line) => line.replace(prefix, ""))
    .join("\n");
}

/**
 * "Randevunuz(u) … <done>" with up to four words between ("randevunuzu
 * perşembeye taşıdım"), past or formal tense, first person or passive; never
 * a question ("oluşturuldu mu") or an offer ("oluşturmamı ister misiniz").
 */
function claim(verbs: string): RegExp {
  return new RegExp(String.raw`randevunuzu? (?:\S+ ){0,4}?(?:${verbs})(?![a-z])(?!\s*m[iu]\b)`);
}

const CLAIMS: Array<{ fact: keyof CallFacts; pattern: RegExp }> = [
  {
    fact: "booked",
    pattern: claim(
      "olusturuldu|olusturulmustur|olusturdum|alindi|alinmistir|aldim|kaydedildi|kaydedilmistir|kaydettim|onaylandi|onaylanmistir",
    ),
  },
  { fact: "cancelled", pattern: claim("iptal edildi|iptal edilmistir|iptal ettim") },
  {
    fact: "rescheduled",
    pattern: claim(
      "guncellendi|guncellenmistir|guncelledim|tasindi|tasinmistir|tasidim|ertelendi|erteledim|degistirildi|degistirdim",
    ),
  },
];

/**
 * The assistant said it booked, cancelled or moved an appointment, but our
 * records show no such change in this call.
 */
export function unbackedClaims(text: CallText, facts: CallFacts): Array<keyof CallFacts> {
  const said = fold(speakerLines(text.transcript, "agent"));
  return CLAIMS.filter(({ fact, pattern }) => {
    if (!pattern.test(said)) return false;
    // A move is a cancellation plus a booking; either record backs "güncellendi".
    if (fact === "rescheduled") return !(facts.rescheduled || facts.booked);
    return !facts[fact];
  }).map(({ fact }) => fact);
}

/** Life-threatening: the caller should be on the phone with 112, not the clinic. */
const EMERGENCY: RegExp[] = [
  /\bgog(us|s)(um|unde|umde|u)? (cok )?(agri|sikis)/,
  /\bgog(us|s)\S* (\S+ ){0,2}(agri|sikis)/,
  /\bkalbim (\S+ )?(sikis|agri)/,
  /\bnefes(im)? (kesil|daral|tikan)/,
  /\bkan (durmuyor|dinmiyor|kesilmiyor)/,
  /\bkendi(me|ne) zarar ver/,
  /\bolmek istiyorum/,
  /\byuz on iki/,
  /\bkalp krizi/,
  /\bnefes ala?m(iyor|adi|iyo)/,
  /\bnefes almakta zorlan/,
  /\bnefes darligi/,
  /\bkanama(m|si|sı)? (durmuyor|dinmiyor|kesilmiyor)/,
  /\b(cok|durmadan) kan (geliyor|kaybed)/,
  // Not "bayıldım": colloquially "I loved it".
  /\bbayil(di|iyor|acak|mis)\b/,
  /\bbilinc(i|ini)? (kaybi|kapali|yok|kaybetti)/,
  /\balerji(k)? (reaksiyon|sok|tepki)/,
  // An allergy that just started, not one the caller has ("penisiline alerjim var").
  /\balerji(m|si|n)? (tuttu|yapti|basladi)/,
  /\banafilaksi/,
  /\b(bogaz|dil|dudak)(lar)?(im|i|in|imiz)? sis(ti|iyor|mis|meye)/,
  /\bintihar/,
  /\bkendimi (oldur|asmak|oldurmek)/,
  /\bcanima kiy/,
  /\byasamak istemiyorum/,
  /\b(asiri doz|fazla (ilac|hap) (ictim|icti|aldim|aldi))/,
  // "Çok fazla ağrı kesici içtim"; "ağrı kesici aldım ama geçmedi" has no "fazla".
  /\bfazla (\S+ ){0,2}(ilac|hap|kesici|antibiyotik)\S* (ictim|icti|aldim|aldi|yuttum|yuttu)/,
  /\bbir kutu (\S+ )?(ilac|hap)\S* (ictim|icti|yuttum|yuttu)/,
  /\bfelc/,
  /\b(havale|nobet) geciri/,
  /(^|[^\d])112([^\d]|$)/,
];

/** Needs a clinician's attention soon, but is not by itself an emergency. */
const MEDICAL_RISK: RegExp[] = [
  /\bkanama/,
  /\bkaniyor/,
  /\bsislik/,
  /\bsis(ti|mis|iyor)\b/,
  // Not "Ateş" the surname ("Doktor Ateş var mı").
  /\b(yuksek ates|atesim (var|cikti|yukseldi|cok)|atesi (var|cikti|yukseldi)|ates (cikti|yukseldi))/,
  // Not the name "İrina".
  /\birin(li)?\b/,
  /\biltihap/,
  /\b(coumadin|kumadin|warfarin|xarelto|eliquis)/,
  /\bapse/,
  /\bdayanilmaz agri/,
  /\bagri kesici (ise yaramiyor|etmiyor)/,
  /\bhamile(yim)?/,
  /\bkan sulandirici/,
];

/** Phrases that look like a match but are routine dental vocabulary. */
const NOT_A_MATCH: RegExp[] = [/\bkanal tedavi/, /\bnefes kokusu/, /\b112\.? (lira|tl|numara)/];

function matches(text: string, patterns: RegExp[]): boolean {
  const cleaned = NOT_A_MATCH.reduce((current, pattern) => current.replace(pattern, " "), text);
  return patterns.some((pattern) => pattern.test(cleaned));
}

/**
 * Emergency or medical-risk mentions. The caller's own words count; the
 * summary counts too (it paraphrases the caller), and the assistant telling
 * someone to call 112 marks an emergency the prompt already recognised.
 */
export function medicalFlags(text: CallText): Array<"emergency" | "medical_risk"> {
  const caller = fold(`${speakerLines(text.transcript, "user")}\n${text.summary ?? ""}`);
  const assistant = fold(speakerLines(text.transcript, "agent"));
  if (matches(caller, EMERGENCY) || /(^|[^\d])112([^\d]|$)|\byuz on iki/.test(assistant)) {
    return ["emergency"];
  }
  if (matches(caller, MEDICAL_RISK)) return ["medical_risk"];
  return [];
}

/** Every flag for a finished call, in a stable order. */
export function callFlags(text: CallText, facts: CallFacts): CallFlag[] {
  const flags: CallFlag[] = [];
  if (unbackedClaims(text, facts).length > 0) flags.push("unbacked_claim");
  flags.push(...medicalFlags(text));
  return flags;
}
