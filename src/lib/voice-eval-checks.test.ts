import { describe, expect, it } from "vitest";

import { dateTokens } from "../../scripts/voice-eval/dates";
import { scenarios, type CallOutcome } from "../../scripts/voice-eval/scenarios";
import { cutIns, type TranscriptTurn } from "../../scripts/voice-eval/turns";

const TODAY = "2026-10-19"; // a Monday

function outcome(overrides: Partial<CallOutcome> = {}): CallOutcome {
  return {
    agentText: "",
    firstReply: "",
    tools: [],
    newAppointments: [],
    seeded: {},
    disconnectionReason: "agent_hangup",
    userTurns: 0,
    cutIns: 0,
    dates: dateTokens(TODAY),
    ...overrides,
  };
}

const scenario = (id: string) => scenarios.find((s) => s.id === id)!;

describe("dateTokens", () => {
  it("names the next and the following weekday from the run date", () => {
    const dates = dateTokens(TODAY);
    expect(dates.tomorrow).toBe("yirmi Ekim Salı");
    expect(dates.nextTue).toBe("yirmi Ekim Salı");
    expect(dates.followingTue).toBe("yirmi yedi Ekim Salı");
    // Today is Monday: "next Monday" is a week away, never today.
    expect(dates.nextMon).toBe("yirmi altı Ekim Pazartesi");
  });
});

describe('ambiguous-weekday: "says the exact date" follows the run date', () => {
  const check = scenario("ambiguous-weekday").check;
  const failsDate = (agentText: string) =>
    check(outcome({ agentText })).includes("says the exact date");

  it("accepts either Tuesday a caller may mean by 'haftaya Salı'", () => {
    expect(failsDate("Yirmi yedi Ekim Salı saat dokuzda uygun.")).toBe(false);
    expect(failsDate("Yirmi Ekim Salı saat dokuzda uygun.")).toBe(false);
  });

  it("rejects another day, also one whose words end the same way", () => {
    expect(failsDate("Yirmi altı Ekim Pazartesi saat dokuzda uygun.")).toBe(true);
    expect(failsDate("Haftaya Salı saat dokuzda uygun.")).toBe(true);
    // "yedi Ekim" inside "on yedi Ekim" is not the 27th.
    expect(
      check(
        outcome({
          agentText: "On yedi Ekim uygun.",
          dates: { ...dateTokens(TODAY), followingTue: "yedi Ekim Salı" },
        }),
      ),
    ).toContain("says the exact date");
  });
});

/** Words with start/end in seconds, as Retell records them. */
const turn = (role: "agent" | "user", start: number, end: number): TranscriptTurn => ({
  role,
  content: role,
  words: [
    { word: role, start, end },
    { word: role, start: end, end },
  ],
});

describe("cutIns", () => {
  it("counts the agent speaking between two parts of one caller line", () => {
    // Slow caller, 19 Oct run: the agent answered each 1.5 s pause.
    const turns = [
      turn("agent", 0.2, 7.5),
      turn("user", 8.8, 9.3),
      turn("agent", 10.9, 12.6),
      turn("user", 12.4, 14.8),
      turn("agent", 16.4, 18.2),
      turn("user", 18.1, 18.9),
    ];
    expect(cutIns(turns)).toBe(2);
  });

  it("ignores Retell splitting a caller line when the agent stayed silent", () => {
    // Hesitant caller, 19 Oct run: 7 caller turns for 4 lines, no cut-in.
    const turns = [
      turn("agent", 0.2, 7.7),
      turn("user", 9.0, 19.8),
      turn("user", 21.1, 21.7),
      turn("agent", 23.3, 33.6),
      turn("user", 36.0, 44.5),
      turn("agent", 47.9, 54.3),
      turn("user", 58.7, 58.9),
      turn("user", 59.3, 59.5),
      turn("agent", 61.0, 73.8),
      turn("user", 73.7, 74.3),
      turn("user", 74.8, 75.1),
    ];
    expect(cutIns(turns)).toBe(0);
  });

  it("does not count an answer after the line ended (the next line comes 13 s later)", () => {
    const turns = [turn("user", 8.6, 16.8), turn("agent", 18.5, 29.5), turn("user", 31.6, 36.8)];
    expect(cutIns(turns)).toBe(0);
  });

  it("does not count the caller talking over an agent who was already speaking", () => {
    const turns = [
      turn("agent", 20.4, 31.4),
      turn("user", 31.8, 31.8),
      turn("agent", 31.4, 31.8),
      turn("user", 31.9, 37.6),
    ];
    expect(cutIns(turns)).toBe(0);
  });

  it("skips turns without word timings (unintelligible audio, tool calls)", () => {
    const turns: TranscriptTurn[] = [
      turn("user", 50.9, 51.1),
      { role: "user", content: "(unintelligible audio)" },
      { role: "tool_call_invocation", content: "" },
      turn("agent", 55.7, 63.9),
    ];
    expect(cutIns(turns)).toBe(0);
  });
});

describe("turn-taking scenarios alarm only when the agent cut in", () => {
  const booked = (service: string) => [
    { service, date: "2026-10-22", time: "14:00", status: "booked" },
  ];

  it("hesitant-caller passes with Retell's split caller turns and no cut-in", () => {
    const failures = scenario("hesitant-caller").check(
      outcome({ userTurns: 7, cutIns: 0, newAppointments: booked("Muayene / Kontrol") }),
    );
    expect(failures).toEqual([]);
  });

  it("slow-speaker fails when the agent cut in, whatever the turn count", () => {
    const failures = scenario("slow-speaker").check(
      outcome({ userTurns: 4, cutIns: 2, newAppointments: booked("Diş Taşı Temizliği") }),
    );
    expect(failures).toContain("the assistant took the turn during a pause");
  });
});
