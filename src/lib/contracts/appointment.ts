/**
 * Appointment vocabulary shared by the database enums (src/server/db/schema.ts)
 * and the panel UI, so a new status cannot reach one side without the other.
 */
export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_SOURCES = ["voice", "panel"] as const;
export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];

/** Statuses that occupy a practitioner's time. Mirrored in the overlap exclusion constraint. */
export const ACTIVE_APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
] as const satisfies readonly AppointmentStatus[];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Planlandı",
  confirmed: "Onaylandı",
  completed: "Tamamlandı",
  cancelled: "İptal",
  no_show: "Gelmedi",
};

export const APPOINTMENT_SOURCE_LABELS: Record<AppointmentSource, string> = {
  voice: "Asistan",
  panel: "Panel",
};
