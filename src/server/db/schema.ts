import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { ClinicSettingsInput } from "../domain/clinic-settings";

// Column names are snake_cased by the Drizzle `casing` option.

const id = () => uuid().primaryKey().defaultRandom();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const clinicRef = () =>
  uuid()
    .notNull()
    .references(() => clinics.id, { onDelete: "cascade" });

// ─── Enums ───────────────────────────────────────────────────────────────────

export const clinicStatus = pgEnum("clinic_status", ["active", "paused"]);

export const appointmentStatus = pgEnum("appointment_status", [
  "scheduled",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

export const appointmentSource = pgEnum("appointment_source", ["voice", "panel"]);

export const callOutcome = pgEnum("call_outcome", [
  "booked",
  "cancelled",
  "rescheduled",
  "info",
  "transferred",
  "callback",
  "abandoned",
  "other",
]);

export const callbackStatus = pgEnum("callback_status", ["open", "done"]);

/** Statuses that occupy a practitioner's time. Mirrored in the overlap exclusion constraint. */
export const ACTIVE_APPOINTMENT_STATUSES = ["scheduled", "confirmed"] as const;

// ─── Tenant ──────────────────────────────────────────────────────────────────

export const clinics = pgTable("clinics", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  timezone: text().notNull().default("Europe/Istanbul"),
  /** E.164 number connected to the voice platform; identifies the tenant on inbound calls. */
  phoneNumber: text().unique(),
  transferPhoneNumber: text(),
  address: text(),
  settings: jsonb().$type<ClinicSettingsInput>().notNull().default({}),
  status: clinicStatus().notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─── Staff & services ────────────────────────────────────────────────────────

export const practitioners = pgTable(
  "practitioners",
  {
    id: id(),
    clinicId: clinicRef(),
    name: text().notNull(),
    /** Spoken prefix such as "Dt." or "Uzm. Dr." */
    title: text(),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.clinicId)],
);

export const services = pgTable(
  "services",
  {
    id: id(),
    clinicId: clinicRef(),
    name: text().notNull(),
    description: text(),
    /** Alternative phrasings callers use, to help the LLM map speech to a service. */
    aliases: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    durationMinutes: integer().notNull(),
    /** Prices in kuruş. */
    priceMin: integer(),
    priceMax: integer(),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.clinicId),
    check("services_duration_positive", sql`${t.durationMinutes} > 0`),
  ],
);

export const practitionerServices = pgTable(
  "practitioner_services",
  {
    practitionerId: uuid()
      .notNull()
      .references(() => practitioners.id, { onDelete: "cascade" }),
    serviceId: uuid()
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.practitionerId, t.serviceId] })],
);

// ─── Schedule ────────────────────────────────────────────────────────────────

export const workingHours = pgTable(
  "working_hours",
  {
    id: id(),
    clinicId: clinicRef(),
    /** Null means clinic-wide opening hours. */
    practitionerId: uuid().references(() => practitioners.id, { onDelete: "cascade" }),
    /** ISO weekday: 1 = Monday … 7 = Sunday. */
    weekday: smallint().notNull(),
    /** Clinic-local wall time. */
    startTime: time().notNull(),
    endTime: time().notNull(),
  },
  (t) => [
    index().on(t.clinicId, t.weekday),
    check("working_hours_weekday_range", sql`${t.weekday} between 1 and 7`),
    check("working_hours_range_valid", sql`${t.startTime} < ${t.endTime}`),
  ],
);

export const timeOff = pgTable(
  "time_off",
  {
    id: id(),
    clinicId: clinicRef(),
    /** Null means the whole clinic is closed (e.g. public holiday). */
    practitionerId: uuid().references(() => practitioners.id, { onDelete: "cascade" }),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    reason: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.clinicId, t.startsAt),
    check("time_off_range_valid", sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

// ─── Patients & appointments ─────────────────────────────────────────────────

export const patients = pgTable(
  "patients",
  {
    id: id(),
    clinicId: clinicRef(),
    fullName: text().notNull(),
    /** E.164 */
    phone: text().notNull(),
    notes: text(),
    /** First time the privacy notice was played to this patient. */
    kvkkNoticeAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.clinicId, t.phone)],
);

export const calls = pgTable(
  "calls",
  {
    id: id(),
    clinicId: clinicRef(),
    provider: text().notNull(),
    providerCallId: text().notNull(),
    fromNumber: text(),
    toNumber: text(),
    startedAt: timestamp({ withTimezone: true }),
    endedAt: timestamp({ withTimezone: true }),
    durationSeconds: integer(),
    endedReason: text(),
    outcome: callOutcome(),
    summary: text(),
    transcript: text(),
    recordingUrl: text(),
    costUsd: numeric({ precision: 10, scale: 4 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.provider, t.providerCallId), index().on(t.clinicId, t.createdAt)],
);

export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    clinicId: clinicRef(),
    patientId: uuid()
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    practitionerId: uuid()
      .notNull()
      .references(() => practitioners.id, { onDelete: "restrict" }),
    serviceId: uuid()
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    status: appointmentStatus().notNull().default("scheduled"),
    source: appointmentSource().notNull(),
    callId: uuid().references(() => calls.id, { onDelete: "set null" }),
    notes: text(),
    cancelledAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.clinicId, t.startsAt),
    index().on(t.practitionerId, t.startsAt),
    index().on(t.patientId),
    check("appointments_range_valid", sql`${t.startsAt} < ${t.endsAt}`),
    // Overlap prevention lives in a custom migration (EXCLUDE USING gist).
  ],
);

export const callbackRequests = pgTable(
  "callback_requests",
  {
    id: id(),
    clinicId: clinicRef(),
    callId: uuid().references(() => calls.id, { onDelete: "set null" }),
    patientName: text(),
    phone: text(),
    reason: text().notNull(),
    status: callbackStatus().notNull().default("open"),
    resolvedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clinicId, t.status)],
);

export type Clinic = typeof clinics.$inferSelect;
export type Practitioner = typeof practitioners.$inferSelect;
export type Service = typeof services.$inferSelect;
export type WorkingHours = typeof workingHours.$inferSelect;
export type TimeOff = typeof timeOff.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type CallbackRequest = typeof callbackRequests.$inferSelect;
