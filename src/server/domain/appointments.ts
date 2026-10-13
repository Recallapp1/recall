import "server-only";

import { and, asc, count, eq, gt, gte, inArray, lt, sql } from "drizzle-orm";

import { personName } from "@/lib/names";
import { normalizePhone } from "@/lib/phone";

import type { Database, Executor } from "../db";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  appointments,
  patients,
  practitioners,
  services,
  type Appointment,
} from "../db/schema";
import type { ClinicContext } from "./clinics";
import { practitionerDisplayName } from "./clinics";
import { DomainError, isOverlapViolation, isUniqueViolation } from "./errors";
import { autoLinkAppointment, moveFollowUpLink, recomputePlansForAppointment } from "./follow-ups";
import { patientsPerName } from "./patients-per-name";
import { findAvailability } from "./scheduling";
import { numberToWords } from "./speech";
import { isLocalTime, utcToLocal, type LocalDate, type LocalTime } from "./time";

export interface AppointmentSummary {
  id: string;
  patientId: string;
  date: LocalDate;
  time: LocalTime;
  serviceName: string;
  practitionerName: string;
  patientName: string;
  patientPhone: string;
  /** Who the voice booking was for, when recorded (shared numbers). */
  bookedForName: string | null;
  startsAt: Date;
}

export interface BookAppointmentInput {
  serviceId: string;
  practitionerId: string;
  date: LocalDate;
  time: LocalTime;
  patientName: string;
  patientPhone: string | null;
  notes?: string;
  source: Appointment["source"];
  /**
   * The phone was only spoken (no caller ID): never disclose that this number
   * already has an appointment unless the caller also gave the patient's name.
   */
  phoneUnverified?: boolean;
  /** Recorded only with VOICE_SHARED_NUMBER_CHECK: who this appointment is for. */
  bookedForName?: string;
  callId?: string | null;
  /** PATIENTS_PER_NAME (P-12); defaults to the env switch. */
  patientsPerName?: boolean;
  now: Date;
}

/**
 * E.164 phone for a booking or lookup. A number that was given but cannot be
 * valid gets its own error: the assistant most often drops or repeats a digit,
 * and telling it so makes it ask again instead of giving up.
 */
export function requirePhone(input: string | null | undefined, missingMessage: string): string {
  const phone = normalizePhone(input);
  if (phone) return phone;
  if (!input?.trim()) throw new DomainError("PHONE_REQUIRED", missingMessage);
  throw new DomainError(
    "INVALID_PHONE",
    "Telefon numarasını eksik ya da hatalı aldım; numara sıfırla başlayan on bir haneden oluşmalı. Numaranızı tekrar söyler misiniz?",
  );
}

export async function bookAppointment(
  db: Database,
  ctx: ClinicContext,
  input: BookAppointmentInput,
): Promise<{ appointment: AppointmentSummary; created: boolean }> {
  const { clinic } = ctx;
  const phone = requirePhone(input.patientPhone, "Randevu için telefon numaranız gerekiyor.");
  if (!isLocalTime(input.time)) {
    throw new DomainError("INVALID_DATE", "Saati anlayamadım.");
  }

  // Idempotency: a retried tool call must not create a second appointment.
  const existing = await findActiveAppointmentAt(db, clinic, phone, input);
  if (existing) {
    const appointment = await summarize(db, clinic, existing.id);
    if (input.phoneUnverified && !sameFullName(nameOnAppointment(appointment), input.patientName)) {
      throw new DomainError("SLOT_UNAVAILABLE", "Bu saat uygun değil.");
    }
    return { appointment, created: false };
  }
  if (input.source === "voice") {
    await assertVoiceBookingAllowed(db, ctx, phone, input.callId ?? null, input.now);
  }

  const availability = await findAvailability(db, ctx, {
    serviceId: input.serviceId,
    practitionerId: input.practitionerId,
    date: input.date,
    now: input.now,
  });
  const slot = availability.slots.find((s) => s.time === input.time);
  if (!slot) {
    throw new DomainError("SLOT_UNAVAILABLE", "Bu saat artık uygun değil.");
  }
  // The assistant once booked a second, misheard service into the caller's own
  // slot ("sekiz Ekim" heard as "çekim"). A caller cannot be in two treatments
  // at once, so voice bookings may not overlap the patient's own appointments.
  // Staff booking from the panel keep full control.
  if (input.source === "voice") {
    const [busy] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .where(
        and(
          eq(appointments.clinicId, clinic.id),
          eq(patients.clinicId, clinic.id),
          eq(patients.phone, phone),
          inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
          lt(appointments.startsAt, slot.endsAt),
          gt(appointments.endsAt, slot.startsAt),
        ),
      )
      .limit(1);
    if (busy && input.phoneUnverified) {
      throw new DomainError("SLOT_UNAVAILABLE", "Bu saat uygun değil.");
    }
    if (busy) {
      throw new DomainError(
        "PATIENT_BUSY",
        "Bu saatte adınıza zaten bir randevu var. Başka bir saat mi istersiniz, yoksa yalnızca mevcut randevunuz yeterli mi?",
      );
    }
  }

  try {
    const appointmentId = await db.transaction(async (tx) => {
      const perName = input.patientsPerName ?? patientsPerName();
      const patient = await patientForBooking(
        tx,
        clinic.id,
        phone,
        personName(input.patientName),
        perName,
      );
      // A family member filed under the number's patient (unique index still
      // there) keeps their name on the appointment, so search can find it.
      const bookedFor = input.bookedForName ?? (patient.fellBack ? input.patientName : undefined);

      const [created] = await tx
        .insert(appointments)
        .values({
          clinicId: clinic.id,
          patientId: patient.id,
          practitionerId: slot.practitionerId,
          serviceId: availability.service.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          source: input.source,
          callId: input.callId ?? null,
          notes: input.notes,
          ...(bookedFor && { bookedForName: personName(bookedFor) }),
        })
        .returning({ id: appointments.id });
      // Follow-up (Takip): attach to the patient's plan when exactly one fits.
      await autoLinkAppointment(
        tx,
        { clinicId: clinic.id, timeZone: clinic.timezone },
        { id: created.id, patientId: patient.id, serviceId: availability.service.id },
        input.now,
      );
      return created.id;
    });
    return { appointment: await summarize(db, clinic, appointmentId), created: true };
  } catch (error) {
    if (isOverlapViolation(error)) {
      throw new DomainError("SLOT_UNAVAILABLE", "Bu saat az önce doldu.");
    }
    throw error;
  }
}

/**
 * The patient a booking is filed under. Looked up first instead of
 * `ON CONFLICT (clinic_id, phone)`, so it works with and without that unique
 * index (P-12). Off: the number's patient, as before (the oldest if there are
 * several). PATIENTS_PER_NAME: the patient on this number with the same name,
 * else a new record for a family member; while the unique index still exists
 * that insert is refused and the number's patient is used, as today.
 */
async function patientForBooking(
  tx: Executor,
  clinicId: string,
  phone: string,
  fullName: string,
  perName: boolean,
): Promise<{ id: string; fellBack?: true }> {
  // Serialises bookings for one number: two calls cannot both create its patient.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clinicId}), hashtext(${phone}))`);
  const onNumber = await tx
    .select({ id: patients.id, fullName: patients.fullName })
    .from(patients)
    .where(and(eq(patients.clinicId, clinicId), eq(patients.phone, phone)))
    .orderBy(asc(patients.createdAt), asc(patients.id));

  const touch = async (id: string) => {
    await tx
      .update(patients)
      .set({ updatedAt: sql`now()` })
      .where(eq(patients.id, id));
    return { id };
  };
  const insert = async (exec: Executor) => {
    const [created] = await exec
      .insert(patients)
      .values({ clinicId, fullName, phone })
      .returning({ id: patients.id });
    return { id: created!.id };
  };

  const first = onNumber[0];
  if (!first) return insert(tx);
  if (!perName) return touch(first.id);
  const sameName = onNumber.find((patient) => sameFullName(patient.fullName, fullName));
  if (sameName) return touch(sameName.id);
  try {
    // Savepoint: a refused insert must not abort the booking.
    return await tx.transaction((savepoint) => insert(savepoint));
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return { ...(await touch(first.id)), fellBack: true };
  }
}

/**
 * Caps on what the assistant may book (audit P-08): a caller, a script or a
 * manipulated model cannot fill the calendar. Counts active appointments, so a
 * reschedule (cancel + new) or a cancelled booking does not use up the budget.
 */
async function assertVoiceBookingAllowed(
  db: Database,
  { clinic, settings }: ClinicContext,
  phone: string,
  callId: string | null,
  now: Date,
) {
  const { limits } = settings;
  const active = inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]);
  if (callId) {
    const [inCall] = await db
      .select({ value: count() })
      .from(appointments)
      .where(and(eq(appointments.clinicId, clinic.id), eq(appointments.callId, callId), active));
    if ((inCall?.value ?? 0) >= limits.bookingsPerCall) {
      throw new DomainError(
        "BOOKING_LIMIT",
        `Bir görüşmede en fazla ${numberToWords(limits.bookingsPerCall)} randevu oluşturabiliyorum. Diğerleri için klinik ekibimiz sizi geri arayabilir.`,
      );
    }
  }
  const [forNumber] = await db
    .select({ value: count() })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(
      and(
        eq(appointments.clinicId, clinic.id),
        eq(patients.phone, phone),
        eq(appointments.source, "voice"),
        gte(appointments.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
        active,
      ),
    );
  if ((forNumber?.value ?? 0) >= limits.bookingsPerNumberPerDay) {
    throw new DomainError(
      "BOOKING_LIMIT",
      "Bu numara için bugün daha fazla randevu oluşturamıyorum. Klinik ekibimiz sizi geri arayabilir.",
    );
  }
}

/**
 * What a caller without caller ID must know before an appointment found by a
 * spoken number is disclosed or changed: details the real patient knows and a
 * stranger who only has the number does not.
 */
export interface OwnershipCheck {
  patientName: string;
  appointmentDate: LocalDate;
  appointmentTime: LocalTime;
}

/**
 * Full-name match that tolerates speech recognition: case, Turkish letters
 * (ş → s, ı → i …), punctuation and word order are ignored, sounds that Turkish
 * ASR confuses are folded (s/z, t/d, p/b, c/j, k/g, f/v), and a word of four or
 * more letters may differ by one letter ("Test" heard as "Tez"). Every word must
 * still match, and the date and time beside it must match exactly.
 */
export function sameFullName(a: string, b: string): boolean {
  const left = nameWords(a);
  const right = nameWords(b);
  if (left.length === 0 || left.length !== right.length) return false;
  return matchWords(left, right);
}

function nameWords(name: string): string[] {
  return name
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .replace(/z/g, "s")
        .replace(/d/g, "t")
        .replace(/b/g, "p")
        .replace(/j/g, "c")
        .replace(/g/g, "k")
        .replace(/v/g, "f"),
    );
}

/** Pairs every word with a distinct close word (names have a handful of words). */
function matchWords(left: string[], right: string[]): boolean {
  if (left.length === 0) return true;
  const [word, ...rest] = left;
  return right.some(
    (candidate, i) =>
      wordsClose(word, candidate) &&
      matchWords(rest, [...right.slice(0, i), ...right.slice(i + 1)]),
  );
}

function wordsClose(a: string, b: string): boolean {
  if (a === b) return true;
  return Math.max(a.length, b.length) >= 4 && editDistanceAtMostOne(a, b);
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** The name a caller must give for this appointment: who it was booked for, else the patient. */
export function nameOnAppointment(
  summary: Pick<AppointmentSummary, "bookedForName" | "patientName">,
): string {
  return summary.bookedForName ?? summary.patientName;
}

/**
 * Whether upcoming appointments on one number belong to more than one person
 * (names compared like an ownership check: speech-recognition tolerant).
 */
export function isSharedNumber(summaries: readonly AppointmentSummary[]): boolean {
  const names: string[] = [];
  for (const summary of summaries) {
    const name = nameOnAppointment(summary);
    if (!names.some((known) => sameFullName(known, name))) names.push(name);
  }
  return names.length > 1;
}

function matchesCheck(summary: AppointmentSummary, check: OwnershipCheck): boolean {
  return (
    summary.date === check.appointmentDate &&
    summary.time === check.appointmentTime &&
    sameFullName(nameOnAppointment(summary), check.patientName)
  );
}

/** Upcoming appointments for a spoken number, only those the caller has proven to know. */
export async function findVerifiedAppointments(
  db: Database,
  ctx: ClinicContext,
  phoneInput: string | null,
  check: OwnershipCheck,
  now: Date,
): Promise<AppointmentSummary[]> {
  const upcoming = await findUpcomingAppointments(db, ctx, phoneInput, now);
  return upcoming.filter((summary) => matchesCheck(summary, check));
}

/** Upcoming active appointments for a caller, soonest first. */
export async function findUpcomingAppointments(
  db: Database,
  { clinic }: ClinicContext,
  phoneInput: string | null,
  now: Date,
): Promise<AppointmentSummary[]> {
  const phone = requirePhone(
    phoneInput,
    "Randevularınızı bulmak için telefon numaranız gerekiyor.",
  );

  const rows = await summaryQuery(db)
    .where(
      and(
        eq(appointments.clinicId, clinic.id),
        eq(patients.phone, phone),
        inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
        gt(appointments.startsAt, now),
      ),
    )
    .orderBy(asc(appointments.startsAt))
    .limit(5);

  return rows.map((row) => toSummary(row, clinic.timezone));
}

export async function cancelAppointment(
  db: Database,
  ctx: ClinicContext,
  input: { appointmentId: string; phone: string | null; check?: OwnershipCheck; now: Date },
): Promise<AppointmentSummary & { alreadyCancelled?: boolean }> {
  const { summary: owned, status } = await getOwnedAppointment(db, ctx, input, CHANGEABLE);
  // A repeated request (provider retry) reports the cancellation it already made.
  if (status === "cancelled") return { ...owned, alreadyCancelled: true };
  assertCancellable(ctx, owned.startsAt, input.now);

  await db
    .update(appointments)
    .set({ status: "cancelled", cancelledAt: input.now })
    .where(and(eq(appointments.id, owned.id), eq(appointments.clinicId, ctx.clinic.id)));
  await recomputePlansForAppointment(
    db,
    { clinicId: ctx.clinic.id, timeZone: ctx.clinic.timezone },
    owned.id,
    input.now,
  );

  return owned;
}

export async function rescheduleAppointment(
  db: Database,
  ctx: ClinicContext,
  input: {
    appointmentId: string;
    phone: string | null;
    check?: OwnershipCheck;
    date: LocalDate;
    time: LocalTime;
    practitionerId?: string;
    callId?: string | null;
    now: Date;
  },
): Promise<{
  previous: AppointmentSummary;
  appointment: AppointmentSummary;
  alreadyRescheduled?: boolean;
}> {
  const { clinic } = ctx;
  const { summary: owned, status } = await getOwnedAppointment(db, ctx, input, CHANGEABLE);
  if (status === "cancelled") {
    // The same move repeated (provider retry): return the appointment it created.
    const moved = await findMovedAppointment(db, ctx, owned.id, input);
    if (!moved) throw notFound();
    return { previous: owned, appointment: moved, alreadyRescheduled: true };
  }
  assertCancellable(ctx, owned.startsAt, input.now);

  const [current] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, owned.id), eq(appointments.clinicId, clinic.id)));

  const availability = await findAvailability(db, ctx, {
    serviceId: current.serviceId,
    practitionerId: input.practitionerId ?? current.practitionerId,
    date: input.date,
    excludeAppointmentId: current.id,
    now: input.now,
  });
  const slot = availability.slots.find((s) => s.time === input.time);
  if (!slot) {
    throw new DomainError("SLOT_UNAVAILABLE", "Bu saat uygun değil.");
  }

  try {
    // Atomic: the old appointment is only released if the new slot is secured.
    const newId = await db.transaction(async (tx) => {
      await tx
        .update(appointments)
        .set({ status: "cancelled", cancelledAt: input.now })
        .where(and(eq(appointments.id, current.id), eq(appointments.clinicId, clinic.id)));
      const [created] = await tx
        .insert(appointments)
        .values({
          clinicId: clinic.id,
          patientId: current.patientId,
          practitionerId: slot.practitionerId,
          serviceId: current.serviceId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          source: "voice",
          callId: input.callId ?? null,
          notes: current.notes,
          // Who it is for moves with it: the ownership check asks for this name (FA-03).
          bookedForName: current.bookedForName,
        })
        .returning({ id: appointments.id });
      // Rescheduling is cancel + new row: the follow-up link moves with it.
      await moveFollowUpLink(
        tx,
        { clinicId: clinic.id, timeZone: clinic.timezone },
        current.id,
        created.id,
        input.now,
      );
      return created.id;
    });
    return { previous: owned, appointment: await summarize(db, clinic, newId) };
  } catch (error) {
    if (isOverlapViolation(error)) {
      throw new DomainError("SLOT_UNAVAILABLE", "Bu saat az önce doldu.");
    }
    throw error;
  }
}

// ─── Internals ───────────────────────────────────────────────────────────────

function assertCancellable({ settings }: ClinicContext, startsAt: Date, now: Date) {
  const minNoticeMs = settings.booking.cancellationMinNoticeHours * 3_600_000;
  if (minNoticeMs > 0 && startsAt.getTime() - now.getTime() < minNoticeMs) {
    throw new DomainError(
      "TOO_LATE_TO_CANCEL",
      `Randevuya ${settings.booking.cancellationMinNoticeHours} saatten az kaldığı için değişikliği klinik ekibimiz yapabilir.`,
    );
  }
}

/** Statuses a caller's change request can find: active ones, and cancelled for repeats. */
const CHANGEABLE: Appointment["status"][] = [...ACTIVE_APPOINTMENT_STATUSES, "cancelled"];

function notFound() {
  return new DomainError("NOT_FOUND", "Bu numaraya kayıtlı böyle bir randevu bulamadım.");
}

/**
 * The appointment, if it belongs to this phone (and, when given, passes the
 * ownership check). Mismatches are indistinguishable from "not found".
 */
async function getOwnedAppointment(
  db: Database,
  { clinic }: ClinicContext,
  input: { appointmentId: string; phone: string | null; check?: OwnershipCheck },
  statuses: readonly Appointment["status"][],
): Promise<{ summary: AppointmentSummary; status: Appointment["status"] }> {
  const { appointmentId, check } = input;
  const phone = requirePhone(input.phone, "Bu işlem için telefon numaranız gerekiyor.");

  const [row] = await summaryQuery(db).where(
    and(
      eq(appointments.id, appointmentId),
      eq(appointments.clinicId, clinic.id),
      eq(patients.phone, phone),
      inArray(appointments.status, [...statuses]),
    ),
  );
  const summary = row ? toSummary(row, clinic.timezone) : null;
  if (!row || !summary) throw notFound();
  if (check && !matchesCheck(summary, check)) {
    throw new DomainError(
      "VERIFICATION_FAILED",
      "Söylediğiniz bilgilerle eşleşen bir randevu bulamadım.",
    );
  }
  return { summary, status: row.status };
}

/**
 * After a reschedule the old appointment is cancelled and a new one holds the
 * requested slot: same patient and service, at that local date and time.
 */
async function findMovedAppointment(
  db: Database,
  { clinic }: ClinicContext,
  previousId: string,
  target: { date: LocalDate; time: LocalTime; practitionerId?: string },
): Promise<AppointmentSummary | null> {
  const [previous] = await db
    .select({ patientId: appointments.patientId, serviceId: appointments.serviceId })
    .from(appointments)
    .where(and(eq(appointments.id, previousId), eq(appointments.clinicId, clinic.id)));
  if (!previous) return null;

  const rows = await summaryQuery(db).where(
    and(
      eq(appointments.clinicId, clinic.id),
      eq(appointments.patientId, previous.patientId),
      eq(appointments.serviceId, previous.serviceId),
      inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
      ...(target.practitionerId ? [eq(appointments.practitionerId, target.practitionerId)] : []),
    ),
  );
  const match = rows
    .map((row) => toSummary(row, clinic.timezone))
    .find((summary) => summary.date === target.date && summary.time === target.time);
  return match ?? null;
}

async function findActiveAppointmentAt(
  db: Database,
  clinic: ClinicContext["clinic"],
  phone: string,
  input: Pick<BookAppointmentInput, "practitionerId" | "serviceId" | "date" | "time">,
) {
  const rows = await db
    .select({ id: appointments.id, startsAt: appointments.startsAt })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(
      and(
        eq(appointments.clinicId, clinic.id),
        eq(patients.phone, phone),
        eq(appointments.practitionerId, input.practitionerId),
        eq(appointments.serviceId, input.serviceId),
        inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
      ),
    );
  return rows.find((row) => {
    const local = utcToLocal(row.startsAt, clinic.timezone);
    return local.date === input.date && local.time === input.time;
  });
}

async function summarize(
  db: Database,
  clinic: ClinicContext["clinic"],
  appointmentId: string,
): Promise<AppointmentSummary> {
  const [row] = await summaryQuery(db).where(
    and(eq(appointments.id, appointmentId), eq(appointments.clinicId, clinic.id)),
  );
  return toSummary(row, clinic.timezone);
}

function summaryQuery(db: Database) {
  return db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      startsAt: appointments.startsAt,
      serviceName: services.name,
      practitionerName: practitioners.name,
      practitionerTitle: practitioners.title,
      patientName: patients.fullName,
      patientPhone: patients.phone,
      bookedForName: appointments.bookedForName,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(practitioners, eq(practitioners.id, appointments.practitionerId))
    .$dynamic();
}

type SummaryRow = Awaited<ReturnType<ReturnType<typeof summaryQuery>["execute"]>>[number];

function toSummary(row: SummaryRow, timeZone: string): AppointmentSummary {
  const local = utcToLocal(row.startsAt, timeZone);
  return {
    id: row.id,
    patientId: row.patientId,
    date: local.date,
    time: local.time,
    serviceName: row.serviceName,
    practitionerName: practitionerDisplayName({
      name: row.practitionerName,
      title: row.practitionerTitle,
    }),
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    bookedForName: row.bookedForName,
    startsAt: row.startsAt,
  };
}
