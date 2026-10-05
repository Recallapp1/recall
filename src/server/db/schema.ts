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

import {
  ACTIVE_APPOINTMENT_STATUSES,
  APPOINTMENT_SOURCES,
  APPOINTMENT_STATUSES,
} from "../../lib/contracts/appointment";
import { CALL_OUTCOMES } from "../../lib/contracts/call";

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

export const appointmentStatus = pgEnum("appointment_status", APPOINTMENT_STATUSES);

export const appointmentSource = pgEnum("appointment_source", APPOINTMENT_SOURCES);

export const callOutcome = pgEnum("call_outcome", CALL_OUTCOMES);

export const callbackStatus = pgEnum("callback_status", ["open", "done"]);

export const voiceAgentStatus = pgEnum("voice_agent_status", ["pending", "synced", "error"]);

export { ACTIVE_APPOINTMENT_STATUSES };

// ─── Accounts (Better Auth) ──────────────────────────────────────────────────
// Shapes follow Better Auth's core and organization plugin models; property
// names are the field names it expects (src/server/auth, ADR-009). One
// organization per clinic: `clinics.organization_id`.

const userRef = () =>
  uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const users = pgTable("users", {
  id: id(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  /** Platform role (Better Auth admin plugin): "user" or "platform_admin" (Recall team, F6). */
  role: text().notNull().default("user"),
  banned: boolean().notNull().default(false),
  banReason: text(),
  banExpires: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: userRef(),
    token: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    /** The clinic the user is working in; set at sign-in, changed by the clinic switcher. */
    activeOrganizationId: uuid(),
    /** Admin plugin field; impersonation is not granted to any role (F6, F7). */
    impersonatedBy: uuid(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: userRef(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    /** scrypt hash for the "credential" provider. */
    password: text(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId)],
);

/** Password reset and email verification tokens. */
export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.identifier)],
);

export const organizations = pgTable("organizations", {
  id: id(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  logo: text(),
  metadata: text(),
  createdAt: createdAt(),
});

const organizationRef = () =>
  uuid()
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

export const members = pgTable(
  "members",
  {
    id: id(),
    organizationId: organizationRef(),
    userId: userRef(),
    /** Role name(s), comma separated by Better Auth: owner, admin, staff, practitioner or a custom role. */
    role: text().notNull().default("staff"),
    /** For the practitioner role: whose calendar this member sees. */
    practitionerId: uuid().references(() => practitioners.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.organizationId, t.userId), index().on(t.userId)],
);

export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    organizationId: organizationRef(),
    email: text().notNull(),
    role: text(),
    status: text().notNull().default("pending"),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    inviterId: userRef(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.organizationId), index().on(t.email)],
);

/** Clinic-defined roles (Better Auth dynamic access control). */
export const organizationRoles = pgTable(
  "organization_roles",
  {
    id: id(),
    organizationId: organizationRef(),
    role: text().notNull(),
    /** JSON permission map, e.g. {"appointments":["read"]}. */
    permission: text().notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex().on(t.organizationId, t.role)],
);

// ─── Tenant ──────────────────────────────────────────────────────────────────

export const clinics = pgTable("clinics", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  /** Better Auth organization holding the clinic's team (1:1). */
  organizationId: uuid()
    .unique()
    .references(() => organizations.id, { onDelete: "restrict" }),
  timezone: text().notNull().default("Europe/Istanbul"),
  transferPhoneNumber: text(),
  address: text(),
  settings: jsonb().$type<ClinicSettingsInput>().notNull().default({}),
  status: clinicStatus().notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─── Voice ───────────────────────────────────────────────────────────────────

/**
 * The clinic's agent on the voice platform. Our database is the source of
 * truth; the remote agent is a synced copy (docs/decisions/ADR-004).
 */
export const voiceAgents = pgTable("voice_agents", {
  id: id(),
  clinicId: clinicRef().unique(),
  provider: text().notNull(),
  externalAgentId: text().unique(),
  externalLlmId: text(),
  /** Agent version calls are pinned to, so a call never sees a half-applied update. */
  agentVersion: integer(),
  /** Hash of the last spec pushed, to skip no-op syncs. */
  specHash: text(),
  status: voiceAgentStatus().notNull().default("pending"),
  /** Provider error message; never contains patient data. */
  lastError: text(),
  syncedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Inbound numbers. The dialled number identifies the tenant on phone calls. */
export const phoneNumbers = pgTable(
  "phone_numbers",
  {
    id: id(),
    clinicId: clinicRef(),
    /** E.164 */
    e164: text().notNull().unique(),
    provider: text().notNull(),
    /** Telephony carrier behind the number, e.g. "netgsm". */
    carrier: text(),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clinicId)],
);

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

// ─── Personal panel preferences (F3.5) ───────────────────────────────────────

export const memberPreferences = pgTable("member_preferences", {
  memberId: uuid()
    .primaryKey()
    .references(() => members.id, { onDelete: "cascade" }),
  /** Page opened after sign-in: bugun | takvim | randevular. */
  startPage: text().notNull().default("bugun"),
  /** Calendar view; null follows the clinic's default. */
  calendarView: text(),
  /** Practitioner the calendar opens filtered to; null shows everyone. */
  calendarPractitionerId: uuid().references(() => practitioners.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

// ─── Audit ───────────────────────────────────────────────────────────────────

/**
 * Who did what in a clinic (F3.4). `metadata` never holds personal data:
 * ids, role names and changed setting keys only (KVKK).
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    clinicId: uuid().references(() => clinics.id, { onDelete: "cascade" }),
    actorUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    action: text().notNull(),
    targetType: text(),
    targetId: text(),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clinicId, t.createdAt)],
);

// ─── Platform (not tenant-scoped) ────────────────────────────────────────────

/** Demo requests from the public landing page; handled by the Recall team (F6). */
export const demoRequests = pgTable(
  "demo_requests",
  {
    id: id(),
    fullName: text().notNull(),
    clinicName: text().notNull(),
    /** E.164 when it could be normalised, otherwise as entered. */
    phone: text().notNull(),
    email: text(),
    clinicType: text().notNull(),
    message: text(),
    /** Sales follow-up in the console: new | contacted | won | lost. */
    status: text().notNull().default("new"),
    handledAt: timestamp({ withTimezone: true }),
    /** Moment the KVKK consent box was ticked. */
    consentAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.createdAt)],
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
export type VoiceAgent = typeof voiceAgents.$inferSelect;
export type PhoneNumber = typeof phoneNumbers.$inferSelect;
export type DemoRequest = typeof demoRequests.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
