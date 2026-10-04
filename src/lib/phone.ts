/**
 * Normalizes a phone number to E.164. Turkish local formats are assumed when
 * no country code is present, since every clinic is in Türkiye for now.
 * Returns null when the input cannot be a valid number.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 0) return null;

  if (hasPlus) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.startsWith("00")) {
    const rest = digits.slice(2);
    return rest.length >= 8 && rest.length <= 15 ? `+${rest}` : null;
  }
  if (digits.length === 12 && digits.startsWith("90")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+90${digits.slice(1)}`;
  if (digits.length === 10 && !digits.startsWith("0")) return `+90${digits}`;

  return null;
}

/** Masks a phone number for logs and UI lists: +90532***4567 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "gizli";
  if (phone.length <= 8) return "***";
  return `${phone.slice(0, 6)}***${phone.slice(-4)}`;
}

/** Masks a person's name for privacy-preserving confirmation: "Ayşe Yılmaz" → "A*** Y***" */
export function maskName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => `${part.charAt(0).toLocaleUpperCase("tr-TR")}***`)
    .join(" ");
}

/** Readable Turkish format for staff screens: +905321234567 → "0532 123 45 67". */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("90")) {
    const local = digits.slice(2);
    return `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`;
  }
  return phone;
}
