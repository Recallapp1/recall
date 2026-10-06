/**
 * Notification vocabulary shared by the database enums (src/server/db/schema.ts)
 * and the code that plans and sends messages (docs/proposals/TAKIP.md, V0).
 */
export const NOTIFICATION_KINDS = ["appointment_reminder", "follow_up_reminder"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_CHANNELS = ["sms"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = [
  "pending",
  "sending",
  "sent",
  "failed",
  "skipped",
  /** Sending started but its outcome is unknown; never retried (no duplicate SMS). */
  "unknown",
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

/** Why a notification was not sent. Stored as text; never contains personal data. */
export const SKIP_REASONS = [
  /** SMS_SENDING_ENABLED is not "true" (production default). */
  "sending_disabled",
  /** The SMS provider does not deliver (console stub). */
  "provider_disabled",
  /** The clinic has the reminder turned off. */
  "feature_off",
  "no_consent",
  "opted_out",
  "invalid_phone",
  "cap_reached",
  /** The appointment or plan changed or ended before sending. */
  "subject_changed",
  /** Booked after the daily run that would have reminded the patient. */
  "too_late",
  "patient_removed",
] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
  pending: "Bekliyor",
  sending: "Gönderiliyor",
  sent: "Gönderildi",
  failed: "Gönderilemedi",
  skipped: "Gönderilmedi",
  unknown: "Belirsiz",
};
