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

/**
 * Status changes staff can make from the panel. Cancelled is final (the slot
 * may already be taken again); completed and no-show can be corrected.
 */
export const STATUS_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  scheduled: ["confirmed", "completed", "no_show", "cancelled"],
  confirmed: ["scheduled", "completed", "no_show", "cancelled"],
  completed: ["no_show", "confirmed"],
  no_show: ["completed", "confirmed"],
  cancelled: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

/** Button labels for status changes. */
export const STATUS_ACTION_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Planlandı olarak işaretle",
  confirmed: "Onayla",
  completed: "Tamamlandı",
  no_show: "Gelmedi",
  cancelled: "İptal et",
};
