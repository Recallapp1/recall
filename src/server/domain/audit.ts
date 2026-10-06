import "server-only";

import { desc, eq } from "drizzle-orm";

import { safeError } from "@/lib/safe-error";

import type { Executor } from "../db";
import { auditEvents } from "../db/schema";

/** Audited actions (F3.4). Keep names stable: they are stored and filtered on. */
export type AuditAction =
  | "auth.sign_in"
  | "team.invitation_created"
  | "team.invitation_cancelled"
  | "team.invitation_accepted"
  | "team.member_added"
  | "team.member_role_changed"
  | "team.member_removed"
  | "team.role_saved"
  | "team.role_deleted"
  | "settings.updated"
  | "assistant.test_call"
  | "patient.updated"
  | "patient.anonymized"
  | "patient.exported"
  | "call.recording_played"
  | "appointment.created"
  | "appointment.updated"
  | "appointment.status_changed"
  | "platform.clinic_created"
  | "platform.clinic_status_changed"
  | "platform.phone_number_added"
  | "platform.phone_number_removed"
  | "platform.assistant_synced"
  | "platform.member_added"
  | "follow_up_rule.saved"
  | "follow_up_rule.archived"
  | "follow_up_rule.examples_added"
  | "follow_up.started"
  | "follow_up.paused"
  | "follow_up.resumed"
  | "follow_up.stopped"
  | "follow_up.due_changed"
  | "follow_up.visit_recorded"
  | "follow_up.linked"
  | "follow_up.unlinked"
  | "follow_up.consent_recorded"
  | "follow_up.consent_withdrawn"
  | "follow_up.settings_updated"
  | "patient.sms_opt_out"
  | "patient.sms_opt_in"
  | "platform.feature_changed";

export interface AuditInput {
  clinicId: string | null;
  actorUserId: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  /** Ids, role names, setting keys. Never names, phone numbers or free text. */
  metadata?: Record<string, string | number | boolean | null | string[]>;
}

/**
 * Records an audit event. Failures are logged, never thrown: an audit hiccup
 * must not undo the user's action, which has already been committed.
 */
export async function recordAudit(exec: Executor, input: AuditInput): Promise<void> {
  try {
    // Savepoint inside a transaction: a failed insert must not abort the caller's work.
    await exec.transaction((tx) =>
      tx.insert(auditEvents).values({ ...input, metadata: input.metadata ?? {} }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({ msg: "audit.write_failed", action: input.action, error: safeError(error) }),
    );
  }
}

export async function listAuditEvents(exec: Executor, clinicId: string, limit = 100) {
  return exec
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.clinicId, clinicId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);
}
