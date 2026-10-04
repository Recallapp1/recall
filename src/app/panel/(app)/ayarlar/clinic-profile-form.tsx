"use client";

import { useState } from "react";

import { FormField } from "@/components/panel";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { saveClinicProfile } from "./actions";
import { SaveButton, SettingsCard, useSave } from "./_components/settings-ui";

export function ClinicProfileForm({
  initial,
  timeZone,
  editable,
}: {
  initial: { name: string; address: string; transferPhoneNumber: string };
  timeZone: string;
  editable: boolean;
}) {
  const [value, setValue] = useState(initial);
  const { pending, save } = useSave();
  const set = (key: keyof typeof value) => (event: { target: { value: string } }) =>
    setValue((current) => ({ ...current, [key]: event.target.value }));

  return (
    <SettingsCard
      title="Klinik bilgileri"
      description="Asistan kliniği bu adla tanıtır; adres sorulduğunda bu adresi söyler."
      footer={
        editable && (
          <SaveButton pending={pending} onClick={() => save(() => saveClinicProfile(value))} />
        )
      }
    >
      <FormField label="Klinik adı">
        <Input value={value.name} onChange={set("name")} disabled={!editable} maxLength={120} />
      </FormField>
      <FormField label="Adres">
        <Textarea
          value={value.address}
          onChange={set("address")}
          disabled={!editable}
          maxLength={300}
        />
      </FormField>
      <FormField
        label="Aktarma numarası"
        hint="Asistan, arayan bir insanla görüşmek istediğinde aramayı bu numaraya aktarır. Boş bırakılırsa geri arama talebi oluşturur."
      >
        <Input
          type="tel"
          inputMode="tel"
          placeholder="0212 123 45 67"
          value={value.transferPhoneNumber}
          onChange={set("transferPhoneNumber")}
          disabled={!editable}
        />
      </FormField>
      <FormField label="Saat dilimi" hint="Değiştirmek için Recall ekibiyle iletişime geçin.">
        <Input value={timeZone} disabled />
      </FormField>
    </SettingsCard>
  );
}
