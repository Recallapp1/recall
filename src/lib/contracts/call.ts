/** Call vocabulary shared by the database enum and the panel. */
export const CALL_OUTCOMES = [
  "booked",
  "cancelled",
  "rescheduled",
  "info",
  "transferred",
  "callback",
  "abandoned",
  "other",
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  booked: "Randevu alındı",
  cancelled: "Randevu iptal edildi",
  rescheduled: "Randevu ertelendi",
  info: "Bilgi verildi",
  transferred: "Ekibe aktarıldı",
  callback: "Geri arama istendi",
  abandoned: "Yarıda kaldı",
  other: "Diğer",
};

/**
 * Post-call flags (audit F-03, F-04): set by deterministic checks after a call
 * when POST_CALL_FLAGS is on; the panel shows them so a human looks at the call.
 */
export const CALL_FLAGS = ["unbacked_claim", "emergency", "medical_risk"] as const;
export type CallFlag = (typeof CALL_FLAGS)[number];

export const CALL_FLAG_LABELS: Record<CallFlag, string> = {
  unbacked_claim: "Kayıtla uyuşmayan sonuç",
  emergency: "Acil durum belirtisi",
  medical_risk: "Tıbbi risk belirtisi",
};

/** "2 dk 22 sn" */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes} dk ${rest} sn` : `${rest} sn`;
}
