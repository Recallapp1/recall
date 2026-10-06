import type { FollowUpIntervalUnit, FollowUpState, FollowUpView } from "@/lib/contracts/follow-up";

import { addIntervalToDate } from "@/lib/contracts/follow-up";

import { addLocalDays, type LocalDate } from "./time";

/**
 * Follow-up calculation (docs/proposals/TAKIP.md §D). Pure: the database
 * layer loads facts, this decides; the same facts always give the same plan.
 */

export interface PlanFacts {
  state: FollowUpState;
  startedOn: LocalDate;
  intervalValue: number;
  intervalUnit: FollowUpIntervalUnit;
  totalVisits: number | null;
  dueOverrideOn: LocalDate | null;
  /** Clinic-local day the override was set. */
  dueOverrideSetOn: LocalDate | null;
}

/** How one visit row looks today. */
export type VisitStatus =
  /** Counts toward the plan. `auto`: an appointment presumed attended (time passed, not marked). */
  | { kind: "counted"; date: LocalDate; auto: boolean }
  /** A linked appointment still ahead: the plan is booked. */
  | { kind: "booked"; date: LocalDate }
  /** Cancelled or no-show: kept for history, does not count. */
  | { kind: "not_counted"; date: LocalDate; reason: "cancelled" | "no_show" };

export interface VisitInput {
  appointment: { status: string; startsOn: LocalDate; ended: boolean } | null;
  visitedOn: LocalDate | null;
}

/** Product decision 1: a passed, unmarked appointment counts ("otomatik sayıldı"). */
export function classifyVisit(visit: VisitInput): VisitStatus {
  const { appointment } = visit;
  if (!appointment) return { kind: "counted", date: visit.visitedOn!, auto: false };
  const date = appointment.startsOn;
  switch (appointment.status) {
    case "completed":
      return { kind: "counted", date, auto: false };
    case "cancelled":
      return { kind: "not_counted", date, reason: "cancelled" };
    case "no_show":
      return { kind: "not_counted", date, reason: "no_show" };
    default:
      // scheduled / confirmed
      return appointment.ended ? { kind: "counted", date, auto: true } : { kind: "booked", date };
  }
}

export function addInterval(date: LocalDate, value: number, unit: FollowUpIntervalUnit): LocalDate {
  return addIntervalToDate(date, value, unit);
}

export interface PlanOutcome {
  state: FollowUpState;
  visitsDone: number;
  nextDueOn: LocalDate | null;
  lastVisitOn: LocalDate | null;
  booked: boolean;
}

export function computeFollowUp(plan: PlanFacts, visits: VisitStatus[]): PlanOutcome {
  const counted = visits
    .filter((v): v is Extract<VisitStatus, { kind: "counted" }> => v.kind === "counted")
    .map((v) => v.date)
    .sort();
  const visitsDone = counted.length;
  const lastVisitOn = counted.at(-1) ?? null;
  const booked = visits.some((v) => v.kind === "booked");

  // Paused and stopped are staff decisions; counting never overrides them.
  let state = plan.state;
  if (state === "active" || state === "completed") {
    state = plan.totalVisits !== null && visitsDone >= plan.totalVisits ? "completed" : "active";
  }
  if (state === "completed" || state === "stopped") {
    return { state, visitsDone, nextDueOn: null, lastVisitOn, booked };
  }

  // A visit after the override was set supersedes it.
  const overrideHolds =
    plan.dueOverrideOn !== null &&
    !(lastVisitOn && plan.dueOverrideSetOn && lastVisitOn > plan.dueOverrideSetOn);
  const nextDueOn = overrideHolds
    ? plan.dueOverrideOn
    : addInterval(lastVisitOn ?? plan.startedOn, plan.intervalValue, plan.intervalUnit);

  return { state, visitsDone, nextDueOn, lastVisitOn, booked };
}

/** The Takip tab bucket (§D, "Görünen durum"). */
export function followUpView(
  outcome: Pick<PlanOutcome, "state" | "nextDueOn" | "booked">,
  today: LocalDate,
  dueSoonDays: number,
): FollowUpView {
  if (outcome.state !== "active") return outcome.state;
  if (outcome.booked) return "booked";
  if (!outcome.nextDueOn) return "upcoming";
  if (outcome.nextDueOn < today) return "overdue";
  if (outcome.nextDueOn <= addLocalDays(today, dueSoonDays)) return "due";
  return "upcoming";
}

/** Reminder 1 a week before the due date; reminder 2 two weeks after, if still unbooked. */
export const REMINDER_OFFSETS_DAYS = [-7, 14] as const;
