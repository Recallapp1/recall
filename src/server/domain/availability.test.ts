import { describe, expect, it } from "vitest";

import {
  computeSlots,
  intersectRanges,
  pickSpreadSlots,
  subtractIntervals,
  type AvailabilityInput,
  type WeeklyRange,
} from "./availability";

const TZ = "Europe/Istanbul"; // UTC+3, no DST

/** UTC instant for an Istanbul wall-clock time. */
const ist = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`);

const weekdays = (start: string, end: string): WeeklyRange[] =>
  [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: start, endTime: end }));

// 2026-11-02 is a Monday.
const MONDAY = "2026-11-02";

function input(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    date: MONDAY,
    timeZone: TZ,
    now: ist("2026-11-01", "12:00"),
    durationMinutes: 30,
    slotIntervalMinutes: 30,
    minNoticeMinutes: 60,
    maxDaysAhead: 30,
    clinicHours: weekdays("09:00", "12:00"),
    clinicClosures: [],
    practitioners: [{ id: "p1", name: "Dt. Can", hours: [], busy: [] }],
    ...overrides,
  };
}

const times = (slots: { time: string }[]) => slots.map((slot) => slot.time);

describe("computeSlots", () => {
  it("generates slots within clinic hours, ending before close", () => {
    expect(times(computeSlots(input()))).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "11:30",
    ]);
  });

  it("returns UTC instants for the clinic's local time", () => {
    const [first] = computeSlots(input());
    expect(first.startsAt.toISOString()).toBe("2026-11-02T06:00:00.000Z");
    expect(first.endsAt.toISOString()).toBe("2026-11-02T06:30:00.000Z");
  });

  it("does not fit a service that would overrun closing time", () => {
    expect(times(computeSlots(input({ durationMinutes: 60 })))).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
    ]);
  });

  it("is closed on days without clinic hours", () => {
    expect(computeSlots(input({ date: "2026-11-08" }))).toEqual([]); // Sunday
  });

  it("honours a lunch break expressed as two ranges", () => {
    const clinicHours = [
      { weekday: 1, startTime: "09:00", endTime: "10:00" },
      { weekday: 1, startTime: "13:00", endTime: "14:00" },
    ];
    expect(times(computeSlots(input({ clinicHours })))).toEqual([
      "09:00",
      "09:30",
      "13:00",
      "13:30",
    ]);
  });

  it("excludes existing appointments", () => {
    const busy = [{ start: ist(MONDAY, "10:00").getTime(), end: ist(MONDAY, "11:00").getTime() }];
    const practitioners = [{ id: "p1", name: "Dt. Can", hours: [], busy }];
    expect(times(computeSlots(input({ practitioners })))).toEqual([
      "09:00",
      "09:30",
      "11:00",
      "11:30",
    ]);
  });

  it("excludes slots that partially overlap an appointment", () => {
    const busy = [{ start: ist(MONDAY, "10:15").getTime(), end: ist(MONDAY, "10:45").getTime() }];
    const practitioners = [{ id: "p1", name: "Dt. Can", hours: [], busy }];
    expect(times(computeSlots(input({ practitioners })))).toEqual([
      "09:00",
      "09:30",
      "11:00",
      "11:30",
    ]);
  });

  it("returns nothing on a clinic-wide closure", () => {
    const clinicClosures = [
      { start: ist(MONDAY, "00:00").getTime(), end: ist("2026-11-03", "00:00").getTime() },
    ];
    expect(computeSlots(input({ clinicClosures }))).toEqual([]);
  });

  it("intersects practitioner hours with clinic hours", () => {
    const practitioners = [
      {
        id: "p1",
        name: "Dt. Can",
        hours: [{ weekday: 1, startTime: "10:30", endTime: "18:00" }],
        busy: [],
      },
    ];
    expect(times(computeSlots(input({ practitioners })))).toEqual(["10:30", "11:00", "11:30"]);
  });

  it("skips a practitioner who does not work that weekday", () => {
    const practitioners = [
      {
        id: "p1",
        name: "Dt. Can",
        hours: [{ weekday: 2, startTime: "09:00", endTime: "12:00" }],
        busy: [],
      },
    ];
    expect(computeSlots(input({ practitioners }))).toEqual([]);
  });

  it("applies the minimum notice period", () => {
    const now = ist(MONDAY, "09:40");
    expect(times(computeSlots(input({ now })))).toEqual(["11:00", "11:30"]);
  });

  it("rejects past dates and dates beyond the booking window", () => {
    expect(computeSlots(input({ date: "2026-10-30" }))).toEqual([]);
    expect(computeSlots(input({ date: "2026-11-02", maxDaysAhead: 0 }))).toEqual([]);
  });

  it("filters by time of day", () => {
    const clinicHours = weekdays("09:00", "19:00");
    const slots = computeSlots(
      input({ clinicHours, slotIntervalMinutes: 60, timeOfDay: "afternoon" }),
    );
    expect(times(slots)).toEqual(["12:00", "13:00", "14:00", "15:00", "16:00"]);
  });

  it("merges practitioners sorted by time", () => {
    const practitioners = [
      {
        id: "p1",
        name: "Dt. Can",
        hours: [{ weekday: 1, startTime: "11:00", endTime: "12:00" }],
        busy: [],
      },
      {
        id: "p2",
        name: "Dt. Elif",
        hours: [{ weekday: 1, startTime: "09:00", endTime: "10:00" }],
        busy: [],
      },
    ];
    const slots = computeSlots(input({ practitioners }));
    expect(slots.map((s) => `${s.time} ${s.practitionerId}`)).toEqual([
      "09:00 p2",
      "09:30 p2",
      "11:00 p1",
      "11:30 p1",
    ]);
  });

  it("uses practitioner hours alone when the clinic has no opening hours", () => {
    const practitioners = [
      {
        id: "p1",
        name: "Dt. Can",
        hours: [{ weekday: 1, startTime: "20:00", endTime: "21:00" }],
        busy: [],
      },
    ];
    expect(times(computeSlots(input({ clinicHours: [], practitioners })))).toEqual([
      "20:00",
      "20:30",
    ]);
  });
});

describe("pickSpreadSlots", () => {
  const slots = computeSlots(input({ clinicHours: weekdays("09:00", "17:00") }));

  it("returns everything when under the limit", () => {
    expect(pickSpreadSlots(slots.slice(0, 3), 6)).toHaveLength(3);
  });

  it("spreads choices across the day, keeping first and last", () => {
    const picked = times(pickSpreadSlots(slots, 4));
    expect(picked).toHaveLength(4);
    expect(picked[0]).toBe("09:00");
    expect(picked[3]).toBe("16:30");
  });

  it("deduplicates identical times across practitioners", () => {
    const doubled = [
      ...slots.slice(0, 2),
      ...slots.slice(0, 2).map((s) => ({ ...s, practitionerId: "p2" })),
    ];
    expect(times(pickSpreadSlots(doubled, 6))).toEqual(["09:00", "09:30"]);
  });
});

describe("interval helpers", () => {
  it("intersects ranges", () => {
    expect(intersectRanges([[540, 720]], [[600, 1080]])).toEqual([[600, 720]]);
    expect(intersectRanges([[540, 600]], [[600, 660]])).toEqual([]);
  });

  it("subtracts intervals, splitting where needed", () => {
    expect(subtractIntervals([{ start: 0, end: 100 }], [{ start: 40, end: 60 }])).toEqual([
      { start: 0, end: 40 },
      { start: 60, end: 100 },
    ]);
    expect(subtractIntervals([{ start: 0, end: 100 }], [{ start: -10, end: 200 }])).toEqual([]);
  });
});
