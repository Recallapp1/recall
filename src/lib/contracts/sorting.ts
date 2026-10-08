import { z } from "zod";

/** Column sorting for panel tables, in the URL (?sirala=…&yon=artan|azalan). */
export const SORT_DIRECTIONS = ["artan", "azalan"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export const APPOINTMENT_SORT_KEYS = ["tarih", "hasta", "hizmet", "hekim", "durum"] as const;
export type AppointmentSortKey = (typeof APPOINTMENT_SORT_KEYS)[number];

export const PATIENT_SORT_KEYS = ["ad", "randevu", "son", "siradaki"] as const;
export type PatientSortKey = (typeof PATIENT_SORT_KEYS)[number];

export interface Sort<Key extends string> {
  key: Key;
  direction: SortDirection;
}

/** Unknown keys and directions fall back to the table's default order. */
export const sortParams = <Keys extends readonly [string, ...string[]]>(keys: Keys) => ({
  sirala: z.enum(keys).optional().catch(undefined),
  yon: z.enum(SORT_DIRECTIONS).optional().catch(undefined),
});

/** The direction a header link switches to: same column flips, a new one starts ascending. */
export function nextDirection<Key extends string>(
  current: Sort<Key> | undefined,
  key: Key,
): SortDirection {
  return current?.key === key && current.direction === "artan" ? "azalan" : "artan";
}
