import "server-only";

import { and, count, eq, isNotNull, isNull } from "drizzle-orm";

import type { Executor } from "../db";
import {
  appointments,
  auditEvents,
  callbackRequests,
  callPatients,
  calls,
  clinics,
  followUpPlans,
  followUpVisits,
  notifications,
  organizations,
  patients,
  phoneNumbers,
  practitioners,
  providerDeletions,
  services,
  toolRequests,
  workingHours,
  timeOff,
} from "../db/schema";
import { enqueueProviderDeletions } from "./provider-deletions";

/*
 * Closing a clinic (full audit A16; DATA-RETENTION.md "Klinik hesabı
 * kapatıldığında"). Three steps, run by the Recall team with the offboarding
 * script, never from the panel:
 *   1. export: the clinic's data, handed to the clinic;
 *   2. erase: personal data deleted, provider copies queued for deletion,
 *      clinic paused and its numbers switched off;
 *   3. purge: once the provider has confirmed every deletion, the clinic
 *      itself is deleted and a receipt without personal data is kept.
 */

export async function exportClinicData(exec: Executor, clinicId: string) {
  const [clinic] = await exec.select().from(clinics).where(eq(clinics.id, clinicId));
  if (!clinic) throw new Error("clinic not found");
  return {
    clinic,
    practitioners: await exec
      .select()
      .from(practitioners)
      .where(eq(practitioners.clinicId, clinicId)),
    services: await exec.select().from(services).where(eq(services.clinicId, clinicId)),
    workingHours: await exec.select().from(workingHours).where(eq(workingHours.clinicId, clinicId)),
    timeOff: await exec.select().from(timeOff).where(eq(timeOff.clinicId, clinicId)),
    patients: await exec.select().from(patients).where(eq(patients.clinicId, clinicId)),
    appointments: await exec.select().from(appointments).where(eq(appointments.clinicId, clinicId)),
    // Recording links are short-lived provider URLs and are not exported.
    calls: (await exec.select().from(calls).where(eq(calls.clinicId, clinicId))).map(
      ({ recordingUrl: _recordingUrl, ...call }) => call,
    ),
    callbackRequests: await exec
      .select()
      .from(callbackRequests)
      .where(eq(callbackRequests.clinicId, clinicId)),
    followUpPlans: await exec
      .select()
      .from(followUpPlans)
      .where(eq(followUpPlans.clinicId, clinicId)),
    followUpVisits: await exec
      .select()
      .from(followUpVisits)
      .where(eq(followUpVisits.clinicId, clinicId)),
  };
}

export interface ErasureCounts {
  patients: number;
  appointments: number;
  calls: number;
  callbackRequests: number;
  providerDeletionsQueued: number;
}

export async function eraseClinicData(
  exec: Executor,
  clinicId: string,
  now: Date,
): Promise<ErasureCounts> {
  return exec.transaction(async (tx) => {
    // Paused first: the assistant stops booking while the rows go.
    const [clinic] = await tx
      .update(clinics)
      .set({ status: "paused" })
      .where(eq(clinics.id, clinicId))
      .returning({ id: clinics.id });
    if (!clinic) throw new Error("clinic not found");
    await tx
      .update(phoneNumbers)
      .set({ isActive: false })
      .where(eq(phoneNumbers.clinicId, clinicId));

    const providerCalls = await tx
      .select({ provider: calls.provider, providerCallId: calls.providerCallId })
      .from(calls)
      .where(eq(calls.clinicId, clinicId));
    // Same transaction as the deletion: once committed, the provider copies cannot be forgotten.
    await enqueueProviderDeletions(tx, clinicId, providerCalls, "clinic_closed", now);

    const del = async (
      table:
        | typeof followUpVisits
        | typeof followUpPlans
        | typeof notifications
        | typeof callbackRequests
        | typeof callPatients
        | typeof toolRequests
        | typeof appointments
        | typeof patients
        | typeof calls,
    ) => (await tx.delete(table).where(eq(table.clinicId, clinicId)).returning()).length;

    // Children before parents: several links are "restrict".
    await del(followUpVisits);
    await del(followUpPlans);
    await del(notifications);
    const callbacks = await del(callbackRequests);
    await del(callPatients);
    await del(toolRequests);
    const appointmentCount = await del(appointments);
    const patientCount = await del(patients);
    const callCount = await del(calls);

    const counts: ErasureCounts = {
      patients: patientCount,
      appointments: appointmentCount,
      calls: callCount,
      callbackRequests: callbacks,
      providerDeletionsQueued: providerCalls.length,
    };
    await tx.insert(auditEvents).values({
      clinicId,
      action: "clinic.data_erased",
      targetType: "clinic",
      targetId: clinicId,
      metadata: { ...counts },
    });
    return counts;
  });
}

export interface PurgeReceipt {
  clinicId: string;
  slug: string;
  providerDeletionsDone: number;
  purgedAt: string;
}

export async function purgeClinic(
  exec: Executor,
  clinicId: string,
  now: Date,
): Promise<PurgeReceipt> {
  return exec.transaction(async (tx) => {
    const [clinic] = await tx.select().from(clinics).where(eq(clinics.id, clinicId));
    if (!clinic) throw new Error("clinic not found");
    const [{ remaining }] = (await tx
      .select({ remaining: count() })
      .from(patients)
      .where(eq(patients.clinicId, clinicId))) as [{ remaining: number }];
    const [erased] = await tx
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(and(eq(auditEvents.clinicId, clinicId), eq(auditEvents.action, "clinic.data_erased")))
      .limit(1);
    if (!erased || remaining > 0) throw new Error("purge refused: called before erase");

    const [{ pending }] = (await tx
      .select({ pending: count() })
      .from(providerDeletions)
      .where(and(eq(providerDeletions.clinicId, clinicId), isNull(providerDeletions.doneAt)))) as [
      { pending: number },
    ];
    if (pending > 0) {
      throw new Error(`purge refused: ${pending} provider deletion(s) not confirmed yet`);
    }
    const [{ done }] = (await tx
      .select({ done: count() })
      .from(providerDeletions)
      .where(
        and(eq(providerDeletions.clinicId, clinicId), isNotNull(providerDeletions.doneAt)),
      )) as [{ done: number }];

    const receipt: PurgeReceipt = {
      clinicId,
      slug: clinic.slug,
      providerDeletionsDone: done,
      purgedAt: now.toISOString(),
    };
    // Everything clinic-scoped cascades, including its audit trail and the
    // deletion queue; the receipt below is the platform-level record.
    await tx.delete(clinics).where(eq(clinics.id, clinicId));
    if (clinic.organizationId) {
      await tx.delete(organizations).where(eq(organizations.id, clinic.organizationId));
    }
    await tx.insert(auditEvents).values({
      clinicId: null,
      action: "clinic.purged",
      targetType: "clinic",
      targetId: clinicId,
      metadata: { ...receipt },
    });
    return receipt;
  });
}
