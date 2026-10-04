import { describe, expect, it } from "vitest";

import { formatMinute, hourMarks, layoutColumn } from "./layout";

const range = { startMinute: 8 * 60, endMinute: 20 * 60 };
const event = (id: string, start: number, end: number) => ({
  id,
  columnId: "dr-a",
  startMinute: start,
  endMinute: end,
});

describe("layoutColumn", () => {
  it("positions events as fractions of the visible range", () => {
    const [placed] = layoutColumn([event("a", 9 * 60, 10 * 60)], range);
    expect(placed).toMatchObject({ top: 1 / 12, height: 1 / 12, lane: 0, lanes: 1 });
  });

  it("splits overlapping events into lanes and keeps back-to-back events full width", () => {
    const placed = layoutColumn(
      [event("a", 540, 600), event("b", 570, 630), event("c", 630, 660)],
      range,
    );
    const byId = Object.fromEntries(placed.map((item) => [item.event.id, item]));
    expect(byId.a).toMatchObject({ lane: 0, lanes: 2 });
    expect(byId.b).toMatchObject({ lane: 1, lanes: 2 });
    expect(byId.c).toMatchObject({ lane: 0, lanes: 1 });
  });

  it("reuses a freed lane inside the same cluster", () => {
    const placed = layoutColumn(
      [event("long", 540, 720), event("x", 540, 600), event("y", 600, 660)],
      range,
    );
    const byId = Object.fromEntries(placed.map((item) => [item.event.id, item]));
    expect(byId.long?.lanes).toBe(2);
    expect(byId.y?.lane).toBe(byId.x?.lane);
  });

  it("clips events at the edges and drops events outside the range", () => {
    const placed = layoutColumn(
      [event("early", 7 * 60, 9 * 60), event("night", 21 * 60, 22 * 60)],
      range,
    );
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({ top: 0, height: 1 / 12 });
  });
});

describe("hourMarks and formatMinute", () => {
  it("lists whole hours inside the range", () => {
    expect(hourMarks({ startMinute: 510, endMinute: 690 }).map(formatMinute)).toEqual([
      "09:00",
      "10:00",
      "11:00",
    ]);
  });
});
