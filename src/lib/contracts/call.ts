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

/** "2 dk 22 sn" */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes} dk ${rest} sn` : `${rest} sn`;
}
