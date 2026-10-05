/**
 * Turkish public holidays for the "Resmî tatilleri ekle" shortcut (F5.3).
 * Fixed holidays are generated; religious holidays follow the lunar calendar
 * and are listed per year from the Diyanet calendar. Half days (arife,
 * 28 Ekim) close from 13:00. Add the next year's religious dates when known.
 */
export interface PublicHoliday {
  name: string;
  /** First day, clinic-local "YYYY-MM-DD". */
  startDate: string;
  /** Last day, inclusive. */
  endDate: string;
  /** Closed from this time on the first day (half-day holidays). */
  fromTime?: string;
}

const RELIGIOUS: Record<number, PublicHoliday[]> = {
  2026: [
    {
      name: "Ramazan Bayramı arifesi",
      startDate: "2026-03-19",
      endDate: "2026-03-19",
      fromTime: "13:00",
    },
    { name: "Ramazan Bayramı", startDate: "2026-03-20", endDate: "2026-03-22" },
    {
      name: "Kurban Bayramı arifesi",
      startDate: "2026-05-26",
      endDate: "2026-05-26",
      fromTime: "13:00",
    },
    { name: "Kurban Bayramı", startDate: "2026-05-27", endDate: "2026-05-30" },
  ],
  2027: [
    {
      name: "Ramazan Bayramı arifesi",
      startDate: "2027-03-08",
      endDate: "2027-03-08",
      fromTime: "13:00",
    },
    { name: "Ramazan Bayramı", startDate: "2027-03-09", endDate: "2027-03-11" },
    {
      name: "Kurban Bayramı arifesi",
      startDate: "2027-05-15",
      endDate: "2027-05-15",
      fromTime: "13:00",
    },
    { name: "Kurban Bayramı", startDate: "2027-05-16", endDate: "2027-05-19" },
  ],
};

export const HOLIDAY_YEARS = Object.keys(RELIGIOUS).map(Number);

export function turkishPublicHolidays(year: number): PublicHoliday[] {
  const day = (month: number, date: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
  const single = (name: string, month: number, date: number, fromTime?: string): PublicHoliday => ({
    name,
    startDate: day(month, date),
    endDate: day(month, date),
    ...(fromTime && { fromTime }),
  });

  return [
    single("Yılbaşı", 1, 1),
    single("Ulusal Egemenlik ve Çocuk Bayramı", 4, 23),
    single("Emek ve Dayanışma Günü", 5, 1),
    single("Atatürk'ü Anma, Gençlik ve Spor Bayramı", 5, 19),
    single("Demokrasi ve Millî Birlik Günü", 7, 15),
    single("Zafer Bayramı", 8, 30),
    single("Cumhuriyet Bayramı arifesi", 10, 28, "13:00"),
    single("Cumhuriyet Bayramı", 10, 29),
    ...(RELIGIOUS[year] ?? []),
  ].toSorted((a, b) => a.startDate.localeCompare(b.startDate));
}
