/**
 * Turkish spoken forms for numbers, times and phone numbers. Text-to-speech
 * engines switch tone or language on raw digits, so anything the assistant
 * reads aloud is given to the model already in words.
 */

import { displayDate, type LocalDate } from "./time";

const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];

/** 0–9999 in Turkish words: 1475 → "bin dört yüz yetmiş beş". */
export function numberToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 9999) throw new Error(`Unsupported number: ${n}`);
  if (n === 0) return "sıfır";

  const parts: string[] = [];
  const thousands = Math.floor(n / 1000);
  const hundreds = Math.floor((n % 1000) / 100);
  const rest = n % 100;

  // Turkish says "bin" and "yüz", not "bir bin" / "bir yüz".
  if (thousands > 0) parts.push(thousands === 1 ? "bin" : `${ONES[thousands]} bin`);
  if (hundreds > 0) parts.push(hundreds === 1 ? "yüz" : `${ONES[hundreds]} yüz`);
  if (rest >= 10) parts.push(TENS[Math.floor(rest / 10)]);
  if (rest % 10 > 0) parts.push(ONES[rest % 10]);
  return parts.join(" ");
}

/** "2026-11-05" → "beş Kasım Perşembe". */
export function spokenDate(date: LocalDate): string {
  const [day, ...rest] = displayDate(date).split(" ");
  return [numberToWords(Number(day)), ...rest].join(" ");
}

/** "14:30" → "on dört otuz", "09:00" → "dokuz", "10:05" → "on sıfır beş". */
export function spokenTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const hour = numberToWords(hours);
  if (minutes === 0) return hour;
  return minutes < 10
    ? `${hour} sıfır ${numberToWords(minutes)}`
    : `${hour} ${numberToWords(minutes)}`;
}

/**
 * Reads a Turkish number the way people dictate it: "+905321234567" →
 * "sıfır beş yüz otuz iki, yüz yirmi üç, kırk beş, altmış yedi".
 * Non-Turkish numbers are read digit by digit.
 */
export function spokenPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("90")) {
    const local = digits.slice(2); // 5321234567
    const groups = [local.slice(0, 3), local.slice(3, 6), local.slice(6, 8), local.slice(8, 10)];
    return ["sıfır " + groupWords(groups[0]), ...groups.slice(1).map(groupWords)].join(", ");
  }
  return digits
    .split("")
    .map((d) => numberToWords(Number(d)))
    .join(" ");
}

/** A dictation group; a leading zero is read on its own ("05" → "sıfır beş"). */
function groupWords(group: string): string {
  if (group.startsWith("0")) {
    return group
      .split("")
      .map((d) => numberToWords(Number(d)))
      .join(" ");
  }
  return numberToWords(Number(group));
}
