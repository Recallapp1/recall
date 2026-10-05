import type { Metadata } from "next";

import { HOLIDAY_YEARS } from "@/lib/holidays";
import { can, requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { loadClinicDirectory, practitionerDisplayName } from "@/server/domain/clinics";
import { listTimeOff } from "@/server/domain/settings";

import { TimeOffManager } from "./time-off-manager";

export const metadata: Metadata = { title: "Tatil ve izinler" };

export default async function TimeOffPage() {
  const { clinic } = await requirePermission({ clinicSettings: ["read"] });
  const [entries, directory, editable] = await Promise.all([
    listTimeOff(db(), clinic.id, new Date()),
    loadClinicDirectory(db(), clinic.id),
    can({ clinicSettings: ["update"] }),
  ]);
  const practitioners = directory.practitioners.map((p) => ({
    id: p.id,
    name: practitionerDisplayName(p),
  }));
  const format = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "short",
    timeZone: clinic.timezone,
  });
  const time = new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: clinic.timezone,
  });

  return (
    <TimeOffManager
      editable={editable}
      practitioners={practitioners}
      years={HOLIDAY_YEARS.filter((year) => year >= new Date().getFullYear())}
      entries={entries.map((entry) => {
        // Whole days end at local midnight; show the last closed day instead.
        const lastDay = new Date(entry.endsAt.getTime() - 1);
        const startTime = time.format(entry.startsAt);
        const endTime = time.format(entry.endsAt);
        const wholeDays = startTime === "00:00" && endTime === "00:00";
        const firstLabel = format.format(entry.startsAt);
        const lastLabel = format.format(lastDay);
        return {
          id: entry.id,
          who: entry.practitionerId
            ? (practitioners.find((p) => p.id === entry.practitionerId)?.name ?? "Hekim")
            : "Tüm klinik",
          when: wholeDays
            ? firstLabel === lastLabel
              ? firstLabel
              : `${firstLabel} – ${lastLabel}`
            : `${firstLabel}, ${startTime}–${endTime === "23:59" ? "gün sonu" : endTime}`,
          reason: entry.reason,
        };
      })}
    />
  );
}
