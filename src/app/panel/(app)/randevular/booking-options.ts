import "server-only";

import { db } from "@/server/db";
import { loadClinicDirectory, practitionerDisplayName } from "@/server/domain/clinics";
import type { ClinicContext } from "@/server/domain/clinics";
import { localToday } from "@/server/domain/time";

import type { BookingOptions } from "./new-appointment-dialog";

export async function loadBookingOptions(context: ClinicContext): Promise<BookingOptions> {
  const directory = await loadClinicDirectory(db(), context.clinic.id);
  return {
    services: directory.services.map((s) => ({
      id: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
    })),
    practitioners: directory.practitioners.map((p) => ({
      id: p.id,
      name: practitionerDisplayName(p),
    })),
    today: localToday(new Date(), context.clinic.timezone),
  };
}
