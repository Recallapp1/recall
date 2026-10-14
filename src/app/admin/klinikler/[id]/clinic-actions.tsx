"use client";

import { Pause, Play, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import {
  CLINIC_LIMIT_FIELDS,
  type ClinicLimitKey,
  type ClinicLimits,
} from "@/lib/contracts/platform";

import { SaveButton, useSave } from "../../../panel/(app)/ayarlar/_components/settings-ui";
import {
  addClinicMemberAction,
  addPhoneNumberAction,
  removePhoneNumberAction,
  setClinicFeatureAction,
  setClinicLimitsAction,
  setClinicStatusAction,
  syncAssistantAction,
  resetTwoFactorAction,
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

/**
 * Recall owner only: resets someone's two-step sign-in after calling the
 * clinic back on its registered number (owner's decision 2026-10-12).
 */
export function ResetTwoFactorButton({
  clinicId,
  userId,
  name,
}: {
  clinicId: string;
  userId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [calledBack, setCalledBack] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          2 adımı sıfırla
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{name}: iki adımlı girişi sıfırla</DialogTitle>
          <DialogDescription>
            Kayıtlı kimlik doğrulama ve yedek kodlar silinir, tüm oturumlar kapanır; kişi bir
            sonraki girişte yeniden kurar. Kayda geçer.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2.5">
          <Checkbox
            id={`called-back-${userId}`}
            checked={calledBack}
            onCheckedChange={(value) => setCalledBack(value === true)}
          />
          <Label htmlFor={`called-back-${userId}`} className="font-normal text-body">
            Kliniği sistemdeki kayıtlı numarasından geri arayıp bu talebi doğruladım
          </Label>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={!calledBack || pending}
            onClick={() =>
              startTransition(async () => {
                const result = await resetTwoFactorAction({ clinicId, userId, calledBack });
                if (result.ok) {
                  toast.success(result.message);
                  setOpen(false);
                } else toast.error(result.message);
              })
            }
          >
            Sıfırla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Abuse and cost limits (CONSOLE_LIMITS_EDIT): Recall team only, audited. */
export function LimitsForm({ clinicId, limits }: { clinicId: string; limits: ClinicLimits }) {
  const [value, setValue] = useState<Record<ClinicLimitKey, string>>(
    () =>
      Object.fromEntries(
        (Object.keys(CLINIC_LIMIT_FIELDS) as ClinicLimitKey[]).map((key) => [
          key,
          String(limits[key]),
        ]),
      ) as Record<ClinicLimitKey, string>,
  );
  const { pending, save } = useSave();
  const keys = Object.keys(CLINIC_LIMIT_FIELDS) as ClinicLimitKey[];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {keys.map((key) => {
          const field = CLINIC_LIMIT_FIELDS[key];
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={`limit-${key}`} className="text-sm text-heading">
                {field.label}
              </Label>
              <Input
                id={`limit-${key}`}
                type="number"
                inputMode="numeric"
                min={field.min}
                max={field.max}
                value={value[key]}
                onChange={(event) => setValue((v) => ({ ...v, [key]: event.target.value }))}
                className="h-10"
              />
              <span className="text-xs text-body">
                {field.min}–{field.max} · varsayılan {field.fallback}
              </span>
            </div>
          );
        })}
      </div>
      <SaveButton
        pending={pending}
        onClick={() =>
          save(() =>
            setClinicLimitsAction({
              clinicId,
              limits: Object.fromEntries(keys.map((key) => [key, Number(value[key])])),
            }),
          )
        }
      >
        Sınırları kaydet
      </SaveButton>
    </div>
  );
}
