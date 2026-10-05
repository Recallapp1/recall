"use client";

import { useState } from "react";

import { FormField } from "@/components/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { START_PAGES, type MemberPreferencesInput, type StartPage } from "@/lib/contracts/settings";

import { SaveButton, SettingsCard, useSave } from "../ayarlar/_components/settings-ui";
import { savePreferences } from "./actions";

const CLINIC_DEFAULT = "clinic";
const EVERYONE = "all";
const VIEW_LABELS = { gun: "Gün", hafta: "Hafta" } as const;

export function PreferencesForm({
  initial,
  clinicCalendarView,
  practitioners,
  showPractitionerFilter,
}: {
  initial: MemberPreferencesInput;
  clinicCalendarView: "gun" | "hafta";
  practitioners: { id: string; name: string }[];
  showPractitionerFilter: boolean;
}) {
  const [value, setValue] = useState(initial);
  const { pending, save } = useSave();

  return (
    <SettingsCard
      title="Panel tercihleri"
      footer={<SaveButton pending={pending} onClick={() => save(() => savePreferences(value))} />}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Girişte açılan sayfa">
          {(field) => (
            <Select
              value={value.startPage}
              onValueChange={(startPage) =>
                setValue((v) => ({ ...v, startPage: startPage as StartPage }))
              }
            >
              <SelectTrigger {...field} className="w-full">
                <SelectValue>{START_PAGES[value.startPage].label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(START_PAGES).map(([key, page]) => (
                  <SelectItem key={key} value={key}>
                    {page.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField label="Takvim görünümü">
          {(field) => (
            <Select
              value={value.calendarView ?? CLINIC_DEFAULT}
              onValueChange={(view) =>
                setValue((v) => ({
                  ...v,
                  calendarView: view === CLINIC_DEFAULT ? null : (view as "gun" | "hafta"),
                }))
              }
            >
              <SelectTrigger {...field} className="w-full">
                <SelectValue>
                  {value.calendarView
                    ? VIEW_LABELS[value.calendarView]
                    : `Klinik varsayılanı (${VIEW_LABELS[clinicCalendarView]})`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CLINIC_DEFAULT}>
                  Klinik varsayılanı ({VIEW_LABELS[clinicCalendarView]})
                </SelectItem>
                <SelectItem value="gun">Gün</SelectItem>
                <SelectItem value="hafta">Hafta</SelectItem>
              </SelectContent>
            </Select>
          )}
        </FormField>
        {showPractitionerFilter && (
          <FormField label="Takvimde varsayılan hekim" hint="Takvim bu hekime filtrelenmiş açılır.">
            {(field) => (
              <Select
                value={value.calendarPractitionerId ?? EVERYONE}
                onValueChange={(id) =>
                  setValue((v) => ({ ...v, calendarPractitionerId: id === EVERYONE ? null : id }))
                }
              >
                <SelectTrigger {...field} className="w-full">
                  <SelectValue>
                    {practitioners.find((p) => p.id === value.calendarPractitionerId)?.name ??
                      "Tüm hekimler"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EVERYONE}>Tüm hekimler</SelectItem>
                  {practitioners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
        )}
      </div>
    </SettingsCard>
  );
}
