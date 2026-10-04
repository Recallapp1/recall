"use client";

import { useState } from "react";

import type { WeeklyHours } from "@/lib/contracts/settings";

import { saveClinicHours } from "../actions";
import { SaveButton, SettingsCard, useSave, WeeklyHoursEditor } from "../_components/settings-ui";

export function ClinicHoursForm({
  initial,
  editable,
}: {
  initial: WeeklyHours;
  editable: boolean;
}) {
  const [hours, setHours] = useState(initial);
  const { pending, save } = useSave();
  return (
    <SettingsCard
      title="Klinik çalışma saatleri"
      description="Asistan bu saatlerin dışında randevu vermez. Hekimlerin kendi saatleri bu aralıkların içinde kalır. Öğle arası için güne ikinci bir aralık ekleyin."
      footer={
        editable && (
          <SaveButton pending={pending} onClick={() => save(() => saveClinicHours(hours))} />
        )
      }
    >
      <WeeklyHoursEditor value={hours} onChange={setHours} readOnly={!editable} />
    </SettingsCard>
  );
}
