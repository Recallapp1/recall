import { readFileSync } from "node:fs";

/** Ids and accounts seeded by scripts/e2e-db.ts for this run. */
export interface Fixtures {
  password: string;
  users: Record<"owner" | "staff" | "practitioner" | "ownerB", string>;
  clinicA: { id: string; organizationId: string; practitionerId: string; serviceId: string };
  clinicB: { id: string; organizationId: string; practitionerId: string; serviceId: string };
  clinicC: { id: string; organizationId: string; practitionerId: string; serviceId: string };
  patientA: string;
  followUpPatient: string;
  patientB: string;
  appointmentB: string;
}

let cached: Fixtures | undefined;

export function fixtures(): Fixtures {
  cached ??= JSON.parse(readFileSync("e2e/.fixtures.json", "utf8")) as Fixtures;
  return cached;
}

export const session = (role: keyof Fixtures["users"]) => `e2e/.auth/${role}.json`;
