import "server-only";

import { and, asc, eq, gt, inArray, lt, sql } from "drizzle-orm";

import { normalizePhone } from "@/lib/phone";

import type { Database } from "../db";
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
import { DomainError, isOverlapViolation } from "./errors";
import { autoLinkAppointment, moveFollowUpLink, recomputePlansForAppointment } from "./follow-ups";
import { findAvailability } from "./scheduling";
import { isLocalTime, utcToLocal, type LocalDate, type LocalTime } from "./time";

export interface AppointmentSummary {
  id: string;
  date: LocalDate;
  time: LocalTime;
  serviceName: string;
  practitionerName: string;
  patientName: string;
  patientPhone: string;
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
  callId?: string | null;
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
  if (existing) return { appointment: await summarize(db, clinic, existing.id), created: false };

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
    if (busy) {
      throw new DomainError(
        "PATIENT_BUSY",
        "Bu saatte adınıza zaten bir randevu var. Başka bir saat mi istersiniz, yoksa yalnızca mevcut randevunuz yeterli mi?",
      );
    }
  }

  try {
    const appointmentId = await db.transaction(async (tx) => {
      const [patient] = await tx
        .insert(patients)
        .values({ clinicId: clinic.id, fullName: input.patientName.trim(), phone })
        .onConflictDoUpdate({
          target: [patients.clinicId, patients.phone],
          set: { updatedAt: sql`now()` },
        })
        .returning({ id: patients.id });

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
  input: { appointmentId: string; phone: string | null; now: Date },
): Promise<AppointmentSummary> {
  const owned = await getOwnedActiveAppointment(db, ctx, input.appointmentId, input.phone);
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
    date: LocalDate;
    time: LocalTime;
    practitionerId?: string;
    callId?: string | null;
    now: Date;
  },
): Promise<{ previous: AppointmentSummary; appointment: AppointmentSummary }> {
  const { clinic } = ctx;
  const owned = await getOwnedActiveAppointment(db, ctx, input.appointmentId, input.phone);
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

async function getOwnedActiveAppointment(
  db: Database,
  { clinic }: ClinicContext,
  appointmentId: string,
  phoneInput: string | null,
): Promise<AppointmentSummary> {
  const phone = requirePhone(phoneInput, "Bu işlem için telefon numaranız gerekiyor.");

  const [row] = await summaryQuery(db).where(
    and(
      eq(appointments.id, appointmentId),
      eq(appointments.clinicId, clinic.id),
      eq(patients.phone, phone),
      inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
    ),
  );
  if (!row) {
    throw new DomainError("NOT_FOUND", "Bu numaraya kayıtlı böyle bir randevu bulamadım.");
  }
  return toSummary(row, clinic.timezone);
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
      startsAt: appointments.startsAt,
      serviceName: services.name,
      practitionerName: practitioners.name,
      practitionerTitle: practitioners.title,
      patientName: patients.fullName,
      patientPhone: patients.phone,
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
    date: local.date,
    time: local.time,
    serviceName: row.serviceName,
    practitionerName: practitionerDisplayName({
      name: row.practitionerName,
      title: row.practitionerTitle,
    }),
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    startsAt: row.startsAt,
  };
}
