import "server-only";

import { desc, eq } from "drizzle-orm";

import { env } from "@/lib/env";
import { safeError } from "@/lib/safe-error";

import type { Database, Executor } from "../db";
import { auditEvents } from "../db/schema";
import { raiseAlarm } from "../observability/alarm";

/** Audited actions (F3.4). Keep names stable: they are stored and filtered on. */
export type AuditAction =
  | "auth.sign_in"
  | "auth.two_factor_enabled"
  | "auth.two_factor_disabled"
  | "auth.two_factor_backup_codes_regenerated"
  | "auth.two_factor_backup_code_used"
  | "auth.two_factor_reset_by_recall"
  | "security.auth_endpoint_blocked"
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
  | "call.flagged"
  | "call.reported"
  | "call.marked_test"
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
 * Actions whose trace must exist (docs/HARDENING-2026-10.md): access to
 * sensitive data, erasure, who may do what, numbers and modules. Their audit
 * record is retried, and if it still cannot be written the action fails and
 * an alarm is raised; callers write it first (reads) or in the same
 * transaction as the change.
 */
export const CRITICAL_AUDIT_ACTIONS: ReadonlySet<AuditAction> = new Set<AuditAction>([
  "auth.two_factor_enabled",
  "auth.two_factor_disabled",
  "auth.two_factor_backup_codes_regenerated",
  "auth.two_factor_backup_code_used",
  "auth.two_factor_reset_by_recall",
  "patient.exported",
  "patient.anonymized",
  "call.recording_played",
  "team.invitation_created",
  "team.invitation_cancelled",
  "team.member_added",
  "team.member_role_changed",
  "team.member_removed",
  "team.role_saved",
  "team.role_deleted",
  "platform.member_added",
  "platform.phone_number_added",
  "platform.phone_number_removed",
  "platform.feature_changed",
  "platform.clinic_status_changed",
]);

/**
 * With AUDIT_STRICT (audit A7) these become critical too: every change to
 * patient data, appointments, consent and clinic settings must leave its
 * trace. Off by default; see docs/05-compliance/AUDIT-POLICY.md.
 */
export const STRICT_AUDIT_ACTIONS: ReadonlySet<AuditAction> = new Set<AuditAction>([
  "patient.updated",
  "patient.sms_opt_out",
  "patient.sms_opt_in",
  "appointment.created",
  "appointment.updated",
  "appointment.status_changed",
  "settings.updated",
  "follow_up.started",
  "follow_up.stopped",
  "follow_up.consent_recorded",
  "follow_up.consent_withdrawn",
  "team.invitation_accepted",
  "platform.clinic_created",
]);

function strictAudit(): boolean {
  try {
    return env().AUDIT_STRICT === true;
  } catch {
    // Without a valid environment (some unit tests) the default applies.
    return false;
  }
}

/** Whether a failed write of this record must stop the action. */
export function isCriticalAudit(action: AuditAction, strict: boolean = strictAudit()): boolean {
  return CRITICAL_AUDIT_ACTIONS.has(action) || (strict && STRICT_AUDIT_ACTIONS.has(action));
}

export class AuditWriteError extends Error {
  constructor(readonly action: AuditAction) {
    super(`Audit record could not be written: ${action}`);
    this.name = "AuditWriteError";
  }
}

const CRITICAL_ATTEMPTS = 3;

/**
 * Records an audit event. Ordinary events never throw: an audit hiccup must
 * not undo the user's action. Critical events are retried; if they still
 * fail, an alarm is raised and `AuditWriteError` is thrown.
 */
export async function recordAudit(exec: Executor, input: AuditInput): Promise<void> {
  const critical = isCriticalAudit(input.action);
  for (let attempt = 1; ; attempt += 1) {
    try {
      // Savepoint inside a transaction: a failed insert must not abort the caller's work.
      await exec.transaction((tx) =>
        tx.insert(auditEvents).values({ ...input, metadata: input.metadata ?? {} }),
      );
      return;
    } catch (error) {
      if (!critical) {
        console.error(
          JSON.stringify({
            msg: "audit.write_failed",
            // Counted by a log-based alert (docs/06-operations/MONITORING.md).
            metric: "audit_write_failed",
            action: input.action,
            error: safeError(error),
          }),
        );
        return;
      }
      if (attempt >= CRITICAL_ATTEMPTS) {
        raiseAlarm(
          "audit.critical_write_failed",
          { action: input.action, clinicId: input.clinicId },
          error,
        );
        throw new AuditWriteError(input.action);
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }
}

/**
 * A change and its audit record in one transaction: if the record cannot be
 * written, the change is rolled back too.
 */
export async function withAudit<T>(
  db: Database,
  input: AuditInput,
  change: (tx: Executor) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const result = await change(tx);
    await recordAudit(tx, input);
    return result;
  });
}

export async function listAuditEvents(exec: Executor, clinicId: string, limit = 100) {
  return exec
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.clinicId, clinicId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);
}
