"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import {
  PANEL_MODULE_LABELS,
  PANEL_MODULES,
  type PanelPreferencesInput,
} from "@/lib/contracts/settings";

import { savePanelPreferences } from "./actions";
import { SaveButton, SettingsCard, useSave } from "./_components/settings-ui";

export function PanelPreferencesForm({
  initial,
  editable,
}: {
  initial: PanelPreferencesInput;
  editable: boolean;
}) {
  const [value, setValue] = useState(initial);
  const { pending, save } = useSave();

  return (
    <SettingsCard
      title="Panel"
      description="Ekibinizin menüde göreceği modüller ve takvimin açılış görünümü. Rol yetkileri ayrıca geçerlidir."
      footer={
        editable && (
          <SaveButton pending={pending} onClick={() => save(() => savePanelPreferences(value))} />
        )
      }
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-heading">Görünen modüller</legend>
        {PANEL_MODULES.map((module) => (
          <div key={module} className="flex items-center gap-3">
            <Switch
              id={`module-${module}`}
              checked={!value.hiddenModules.includes(module)}
              disabled={!editable}
              onCheckedChange={(visible) =>
                setValue((current) => ({
                  ...current,
                  hiddenModules: visible
                    ? current.hiddenModules.filter((m) => m !== module)
                    : [...current.hiddenModules, module],
                }))
              }
            />
            <Label htmlFor={`module-${module}`}>{PANEL_MODULE_LABELS[module]}</Label>
          </div>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-heading">Takvim açılış görünümü</legend>
        <div className="flex w-fit rounded-full bg-hairline/70 p-1" role="radiogroup">
          {(
            [
              ["gun", "Gün"],
              ["hafta", "Hafta"],
            ] as const
          ).map(([view, label]) => (
            <button
              key={view}
              type="button"
              role="radio"
              aria-checked={value.defaultCalendarView === view}
              disabled={!editable}
              onClick={() => setValue((current) => ({ ...current, defaultCalendarView: view }))}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                value.defaultCalendarView === view
                  ? "bg-paper text-heading shadow-sm shadow-ink/5"
                  : "text-body hover:text-heading",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
    </SettingsCard>
  );
}
