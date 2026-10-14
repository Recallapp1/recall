import { describe, expect, it } from "vitest";

import { HOLIDAY_YEARS, turkishPublicHolidays } from "./holidays";

describe("Turkish public holidays", () => {
  it("cover the coming two years, so the shortcut keeps working through 2027", () => {
    expect(HOLIDAY_YEARS).toEqual(expect.arrayContaining([2026, 2027, 2028]));
  });

  it("2028: both bayrams with their half-day arife, fixed holidays generated", () => {
    const holidays = turkishPublicHolidays(2028);
    const byName = (name: string) => holidays.find((h) => h.name === name);
    expect(byName("Ramazan Bayramı arifesi")).toMatchObject({
      startDate: "2028-02-25",
      fromTime: "13:00",
    });
    expect(byName("Ramazan Bayramı")).toMatchObject({
      startDate: "2028-02-26",
      endDate: "2028-02-28",
    });
    expect(byName("Kurban Bayramı arifesi")).toMatchObject({
      startDate: "2028-05-04",
      fromTime: "13:00",
    });
    expect(byName("Kurban Bayramı")).toMatchObject({
      startDate: "2028-05-05",
      endDate: "2028-05-08",
    });
    expect(byName("Cumhuriyet Bayramı arifesi")).toMatchObject({
      startDate: "2028-10-28",
      fromTime: "13:00",
    });
    expect(holidays).toHaveLength(12);
  });
});
