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

const CLAIMS: Array<{ fact: keyof CallFacts; pattern: RegExp }> = [
  {
    fact: "booked",
    pattern: /randevunuz (basariyla )?(olusturuldu|alindi|kaydedildi|onaylandi)/,
  },
  { fact: "cancelled", pattern: /randevunuz (basariyla )?iptal edildi/ },
  {
    fact: "rescheduled",
    pattern: /randevunuz (basariyla )?(guncellendi|tasindi|ertelendi|degistirildi)/,
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
  /\bkalp krizi/,
  /\bnefes ala?m(iyor|adi|iyo)/,
  /\bnefes almakta zorlan/,
  /\bnefes darligi/,
  /\bkanama(m|si|sı)? (durmuyor|dinmiyor|kesilmiyor)/,
  /\b(cok|durmadan) kan (geliyor|kaybed)/,
  /\bbayil(di|dim|iyor|acak)/,
  /\bbilinc(i|ini)? (kaybi|kapali|yok|kaybetti)/,
  /\balerji(k)? (reaksiyon|sok)/,
  /\banafilaksi/,
  /\b(bogaz|dil|dudak)(im|i|lar)? sis(ti|iyor|mis)/,
  /\bintihar/,
  /\bkendimi (oldur|asmak|oldurmek)/,
  /\bcanima kiy/,
  /\byasamak istemiyorum/,
  /\b(asiri doz|fazla (ilac|hap) (ictim|icti|aldim|aldi))/,
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
  /\b(yuksek )?ates(im|i)? (var|cikti|yukseldi)/,
  /\birin/,
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
  if (matches(caller, EMERGENCY) || /(^|[^\d])112([^\d]|$)/.test(assistant)) return ["emergency"];
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
