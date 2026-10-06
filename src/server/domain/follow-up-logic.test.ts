import { describe, expect, it } from "vitest";

import {
  addInterval,
  classifyVisit,
  computeFollowUp,
  followUpView,
  type PlanFacts,
  type VisitStatus,
} from "./follow-up-logic";
import { addLocalMonths } from "./time";

const plan = (overrides: Partial<PlanFacts> = {}): PlanFacts => ({
  state: "active",
  startedOn: "2026-01-10",
  intervalValue: 6,
  intervalUnit: "month",
  totalVisits: null,
  dueOverrideOn: null,
  dueOverrideSetOn: null,
  ...overrides,
});

const counted = (date: string, auto = false): VisitStatus => ({ kind: "counted", date, auto });

describe("addLocalMonths / addInterval", () => {
  it("clamps to the end of shorter months, leap years included", () => {
    expect(addLocalMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addLocalMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addLocalMonths("2026-08-31", 6)).toBe("2027-02-28");
    expect(addLocalMonths("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("adds days and weeks as calendar days (no DST drift)", () => {
    expect(addInterval("2026-03-20", 30, "day")).toBe("2026-04-19");
    expect(addInterval("2026-10-20", 2, "week")).toBe("2026-11-03");
  });
});

describe("classifyVisit", () => {
  const appt = (status: string, ended: boolean) => ({
    appointment: { status, startsOn: "2026-02-01", ended },
    visitedOn: null,
  });

  it("counts completed, and passed unmarked appointments as automatic", () => {
    expect(classifyVisit(appt("completed", true))).toEqual(counted("2026-02-01"));
    expect(classifyVisit(appt("scheduled", true))).toEqual(counted("2026-02-01", true));
    expect(classifyVisit(appt("confirmed", true))).toEqual(counted("2026-02-01", true));
  });

  it("treats a future appointment as booked and no-show/cancel as not counted", () => {
    expect(classifyVisit(appt("scheduled", false))).toEqual({ kind: "booked", date: "2026-02-01" });
    expect(classifyVisit(appt("no_show", true))).toMatchObject({
      kind: "not_counted",
      reason: "no_show",
    });
    expect(classifyVisit(appt("cancelled", false))).toMatchObject({
      kind: "not_counted",
      reason: "cancelled",
    });
  });

  it("counts a visit recorded without an appointment", () => {
    expect(classifyVisit({ appointment: null, visitedOn: "2026-03-03" })).toEqual(
      counted("2026-03-03"),
    );
  });
});

describe("computeFollowUp", () => {
  it("counts from the start when there is no visit yet", () => {
    expect(computeFollowUp(plan(), [])).toMatchObject({ nextDueOn: "2026-07-10", visitsDone: 0 });
  });

  it("anchors on the last attended visit: early and late visits move the next date", () => {
    expect(computeFollowUp(plan(), [counted("2026-06-01")]).nextDueOn).toBe("2026-12-01");
    expect(computeFollowUp(plan(), [counted("2026-09-20")]).nextDueOn).toBe("2027-03-20");
  });

  it("ignores no-shows and cancellations (the date stays, the plan goes overdue)", () => {
    const outcome = computeFollowUp(plan(), [
      counted("2026-01-10"),
      { kind: "not_counted", date: "2026-07-10", reason: "no_show" },
    ]);
    expect(outcome).toMatchObject({ visitsDone: 1, nextDueOn: "2026-07-10" });
    expect(followUpView(outcome, "2026-08-01", 14)).toBe("overdue");
  });

  it("completes a fixed course and reopens when a visit is corrected away", () => {
    const course = plan({ intervalValue: 30, intervalUnit: "day", totalVisits: 2 });
    const done = computeFollowUp(course, [counted("2026-01-10"), counted("2026-02-09", true)]);
    expect(done).toMatchObject({ state: "completed", nextDueOn: null, visitsDone: 2 });

    const corrected = computeFollowUp({ ...course, state: "completed" }, [
      counted("2026-01-10"),
      { kind: "not_counted", date: "2026-02-09", reason: "no_show" },
    ]);
    expect(corrected).toMatchObject({ state: "active", nextDueOn: "2026-02-09" });
  });

  it("keeps paused and stopped plans as staff left them", () => {
    expect(computeFollowUp(plan({ state: "paused" }), []).state).toBe("paused");
    expect(computeFollowUp(plan({ state: "stopped" }), [])).toMatchObject({
      state: "stopped",
      nextDueOn: null,
    });
  });

  it("uses the manual date until a later visit supersedes it", () => {
    const withOverride = plan({ dueOverrideOn: "2026-05-01", dueOverrideSetOn: "2026-03-01" });
    expect(computeFollowUp(withOverride, [counted("2026-02-01")]).nextDueOn).toBe("2026-05-01");
    expect(computeFollowUp(withOverride, [counted("2026-04-15")]).nextDueOn).toBe("2026-10-15");
  });

  it("is booked while a linked future appointment exists", () => {
    const outcome = computeFollowUp(plan(), [{ kind: "booked", date: "2026-07-12" }]);
    expect(followUpView(outcome, "2026-07-01", 14)).toBe("booked");
  });
});

describe("followUpView", () => {
  const active = { state: "active" as const, booked: false };
  it("splits active plans by the due date", () => {
    expect(followUpView({ ...active, nextDueOn: "2026-07-09" }, "2026-07-10", 14)).toBe("overdue");
    expect(followUpView({ ...active, nextDueOn: "2026-07-10" }, "2026-07-10", 14)).toBe("due");
    expect(followUpView({ ...active, nextDueOn: "2026-07-24" }, "2026-07-10", 14)).toBe("due");
    expect(followUpView({ ...active, nextDueOn: "2026-07-25" }, "2026-07-10", 14)).toBe("upcoming");
  });
});
