"use client";

import { useState } from "react";

import { FormField } from "@/components/panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { BookingRulesInput } from "@/lib/contracts/settings";

import { saveBookingRules } from "../actions";
import { SaveButton, SettingsCard, useSave } from "../_components/settings-ui";

function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  unit,
  disabled,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  unit: string;
  disabled: boolean;
}) {
  return (
    <FormField label={label} hint={hint}>
      {(field) => (
        <div className="flex items-center gap-2">
          <Input
            {...field}
            type="number"
            min={min}
            max={max}
            value={Number.isFinite(value) ? value : ""}
            disabled={disabled}
            onChange={(event) => onChange(event.target.valueAsNumber)}
            className="w-28"
          />
          <span className="text-sm text-body">{unit}</span>
        </div>
      )}
    </FormField>
  );
}

export function BookingRulesForm({
  initial,
  editable,
}: {
  initial: BookingRulesInput;
  editable: boolean;
}) {
  const [value, setValue] = useState(initial);
  const { pending, save } = useSave();
  const set =
    <K extends keyof BookingRulesInput>(key: K) =>
    (next: BookingRulesInput[K]) =>
      setValue((current) => ({ ...current, [key]: next }));

  return (
    <>
      <SettingsCard
        title="Randevu kuralları"
        description="Asistanın ve panelin önerdiği saatler bu kurallara göre hesaplanır."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField
            label="Slot aralığı"
            hint="15 → 09:00, 09:15, 09:30…"
            value={value.slotIntervalMinutes}
            onChange={set("slotIntervalMinutes")}
            min={5}
            max={120}
            unit="dakika"
            disabled={!editable}
          />
          <NumberField
            label="En erken randevu"
            hint="Şu andan bu kadar sonrası önerilir."
            value={value.minNoticeMinutes}
            onChange={set("minNoticeMinutes")}
            min={0}
            max={10080}
            unit="dakika sonra"
            disabled={!editable}
          />
          <NumberField
            label="En ileri tarih"
            value={value.maxDaysAhead}
            onChange={set("maxDaysAhead")}
            min={1}
            max={365}
            unit="gün"
            disabled={!editable}
          />
          <NumberField
            label="İptal ve erteleme sınırı"
            hint="Randevuya bu süreden az kaldıysa asistan değiştirmez, ekibe yönlendirir."
            value={value.cancellationMinNoticeHours}
            onChange={set("cancellationMinNoticeHours")}
            min={0}
            max={168}
            unit="saat"
            disabled={!editable}
          />
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="allowPractitionerChoice"
            checked={value.allowPractitionerChoice}
            onCheckedChange={set("allowPractitionerChoice")}
            disabled={!editable}
          />
          <Label htmlFor="allowPractitionerChoice">Asistan hasta için hekim tercihi sorsun</Label>
        </div>
      </SettingsCard>

      <SettingsCard
        title="SMS bildirimleri"
        description="SMS gönderimi telefon altyapısı (Netgsm) kurulduğunda devreye girer."
        footer={
          editable && (
            <SaveButton pending={pending} onClick={() => save(() => saveBookingRules(value))} />
          )
        }
      >
        <div className="flex items-center gap-3">
          <Switch
            id="smsConfirmation"
            checked={value.smsConfirmation}
            onCheckedChange={set("smsConfirmation")}
            disabled={!editable}
          />
          <Label htmlFor="smsConfirmation">Randevu oluşunca hastaya onay SMS&apos;i gönder</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="smsReminder"
            checked={value.smsReminderHoursBefore !== null}
            onCheckedChange={(on) => set("smsReminderHoursBefore")(on ? 24 : null)}
            disabled={!editable}
          />
          <Label htmlFor="smsReminder">Randevudan önce hatırlatma SMS&apos;i gönder</Label>
        </div>
        {value.smsReminderHoursBefore !== null && (
          <NumberField
            label="Hatırlatma zamanı"
            value={value.smsReminderHoursBefore}
            onChange={set("smsReminderHoursBefore")}
            min={1}
            max={168}
            unit="saat önce"
            disabled={!editable}
          />
        )}
      </SettingsCard>
    </>
  );
}
