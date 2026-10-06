"use client";

import { Pause, Play, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { SaveButton, useSave } from "../../../panel/(app)/ayarlar/_components/settings-ui";
import {
  addClinicMemberAction,
  addPhoneNumberAction,
  removePhoneNumberAction,
  setClinicFeatureAction,
  setClinicStatusAction,
  syncAssistantAction,
} from "../../actions";

export function ClinicStatusButton({
  clinicId,
  status,
}: {
  clinicId: string;
  status: "active" | "paused";
}) {
  const { pending, save } = useSave();
  const pause = status === "active";
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (pause && !window.confirm("Klinik duraklatılsın mı? Asistan randevu vermeyi bırakır.")) {
          return;
        }
        save(() => setClinicStatusAction(clinicId, pause ? "paused" : "active"));
      }}
    >
      {pause ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
      {pause ? "Duraklat" : "Yeniden aç"}
    </Button>
  );
}

export function AssistantActions({ clinicId, exists }: { clinicId: string; exists: boolean }) {
  const { pending, save } = useSave();
  return (
    <div className="flex flex-wrap gap-2">
      <SaveButton
        pending={pending}
        onClick={() => save(() => syncAssistantAction(clinicId, false))}
      >
        {exists ? <RefreshCw /> : <Sparkles />}
        {exists ? "Senkronize et" : "Asistanı oluştur"}
      </SaveButton>
      {exists && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => save(() => syncAssistantAction(clinicId, true))}
        >
          Zorla yeniden gönder
        </Button>
      )}
    </div>
  );
}

export function PhoneNumbers({
  clinicId,
  numbers,
}: {
  clinicId: string;
  numbers: { id: string; label: string; active: boolean }[];
}) {
  const [value, setValue] = useState("");
  const { pending, save } = useSave();
  return (
    <div className="flex flex-col gap-3">
      {numbers.length === 0 ? (
        <p className="text-sm text-body">Bağlı numara yok.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-hairline">
          {numbers.map((number) => (
            <li key={number.id} className="flex items-center justify-between gap-2 py-2">
              <span className="flex items-center gap-2 text-sm text-heading tabular-nums">
                {number.label}
                {!number.active && <Badge variant="secondary">Pasif</Badge>}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${number.label} numarasını kaldır`}
                disabled={pending}
                onClick={() => {
                  if (
                    window.confirm("Numara kaldırılsın mı? Bu numaraya gelen aramalar reddedilir.")
                  ) {
                    save(() => removePhoneNumberAction(clinicId, number.id));
                  }
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          type="tel"
          aria-label="Yeni numara"
          placeholder="0850 123 45 67"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-10"
        />
        <Button
          variant="secondary"
          disabled={pending || !value}
          onClick={() =>
            save(
              () => addPhoneNumberAction({ clinicId, e164: value }),
              () => setValue(""),
            )
          }
        >
          <Plus data-icon="inline-start" />
          Bağla
        </Button>
      </div>
      <p className="text-xs text-body">
        Numara ses platformuna içe aktarılmalı ve gelen arama webhook&apos;u{" "}
        <code className="rounded bg-canvas px-1">/api/voice/retell/inbound</code> olmalı.
      </p>
    </div>
  );
}

export function AddMemberForm({ clinicId }: { clinicId: string }) {
  const [value, setValue] = useState({ name: "", email: "", role: "owner" as "owner" | "admin" });
  const { pending, save } = useSave();
  return (
    <div className="flex flex-col gap-2 border-t border-hairline pt-4">
      <p className="text-sm font-medium text-heading">Klinik sahibi veya yönetici ekle</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_8rem_auto]">
        <Input
          aria-label="Ad soyad"
          placeholder="Ad soyad"
          value={value.name}
          onChange={(event) => setValue((v) => ({ ...v, name: event.target.value }))}
          className="h-10"
        />
        <Input
          aria-label="E-posta"
          type="email"
          placeholder="E-posta"
          value={value.email}
          onChange={(event) => setValue((v) => ({ ...v, email: event.target.value }))}
          className="h-10"
        />
        <select
          aria-label="Rol"
          value={value.role}
          onChange={(event) =>
            setValue((v) => ({ ...v, role: event.target.value as "owner" | "admin" }))
          }
          className="h-10 rounded-card-sm border border-hairline bg-paper px-3 text-sm text-heading"
        >
          <option value="owner">Klinik sahibi</option>
          <option value="admin">Yönetici</option>
        </select>
        <SaveButton
          pending={pending}
          disabled={!value.name || !value.email}
          onClick={() =>
            save(
              () => addClinicMemberAction({ clinicId, ...value }),
              () => setValue({ name: "", email: "", role: "owner" }),
            )
          }
        >
          Ekle
        </SaveButton>
      </div>
      <p className="text-xs text-body">Diğer ekip üyelerini klinik kendi panelinden davet eder.</p>
    </div>
  );
}

export function FeatureSwitch({
  clinicId,
  feature,
  enabled,
  label,
}: {
  clinicId: string;
  feature: "followUp";
  enabled: boolean;
  label: string;
}) {
  const { pending, save } = useSave();
  return (
    <label className="flex items-center gap-3 text-sm text-heading">
      <Switch
        checked={enabled}
        disabled={pending}
        onCheckedChange={(next) => save(() => setClinicFeatureAction(clinicId, feature, next))}
      />
      {label}
    </label>
  );
}
