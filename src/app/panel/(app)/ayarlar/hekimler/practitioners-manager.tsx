"use client";

import { Pencil, Plus, Stethoscope } from "lucide-react";
import { useState } from "react";

import { EmptyState, FormField } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { PractitionerInput, WeeklyHours } from "@/lib/contracts/settings";

import { savePractitionerSettings } from "../actions";
import {
  SaveButton,
  SettingsCard,
  useSave,
  WeeklyHoursEditor,
  WEEKDAYS,
} from "../_components/settings-ui";

interface Practitioner {
  id: string;
  name: string;
  title: string | null;
  isActive: boolean;
  serviceIds: string[];
  hours: WeeklyHours;
}

const TITLES = [
  "Dt.",
  "Uzm. Dt.",
  "Dr.",
  "Uzm. Dr.",
  "Op. Dr.",
  "Doç. Dr.",
  "Prof. Dr.",
  "Fzt.",
  "Psk.",
  "Dyt.",
];

function summariseHours(hours: WeeklyHours): string {
  if (hours.length === 0) return "Klinik saatleri";
  const days = [...new Set(hours.map((h) => h.weekday))].toSorted();
  return days.map((d) => WEEKDAYS.find(([n]) => n === d)?.[1].slice(0, 3)).join(", ");
}

export function PractitionersManager({
  practitioners,
  services,
  editable,
}: {
  practitioners: Practitioner[];
  services: { id: string; name: string; isActive: boolean }[];
  editable: boolean;
}) {
  const [editing, setEditing] = useState<PractitionerInput | null>(null);

  return (
    <SettingsCard
      title="Hekimler"
      description="Asistan randevuyu bu hekimlerin takvimine verir. Pasif hekime randevu verilmez."
      footer={
        editable && (
          <Button
            variant="outline"
            onClick={() =>
              setEditing({ name: "", title: "Dt.", isActive: true, serviceIds: [], hours: [] })
            }
          >
            <Plus data-icon="inline-start" />
            Hekim ekle
          </Button>
        )
      }
    >
      {practitioners.length === 0 ? (
        <EmptyState icon={Stethoscope} title="Henüz hekim yok" className="border-0" />
      ) : (
        <ul className="flex flex-col divide-y divide-hairline">
          {practitioners.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-heading">
                  {[p.title, p.name].filter(Boolean).join(" ")}
                </span>
                <span className="text-xs text-body">
                  {p.serviceIds.length === 0 ? "Tüm hizmetler" : `${p.serviceIds.length} hizmet`} ·{" "}
                  {summariseHours(p.hours)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!p.isActive && <Badge variant="secondary">Pasif</Badge>}
                {editable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setEditing({
                        id: p.id,
                        name: p.name,
                        title: p.title,
                        isActive: p.isActive,
                        serviceIds: p.serviceIds,
                        hours: p.hours,
                      })
                    }
                  >
                    <Pencil data-icon="inline-start" />
                    Düzenle
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {editing && (
            <PractitionerEditor
              key={editing.id ?? "new"}
              initial={editing}
              services={services}
              onSaved={() => setEditing(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </SettingsCard>
  );
}

function PractitionerEditor({
  initial,
  services,
  onSaved,
}: {
  initial: PractitionerInput;
  services: { id: string; name: string; isActive: boolean }[];
  onSaved: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [ownHours, setOwnHours] = useState(initial.hours.length > 0);
  const { pending, save } = useSave();
  const toggleService = (id: string, on: boolean) =>
    setValue((v) => ({
      ...v,
      serviceIds: on ? [...v.serviceIds, id] : v.serviceIds.filter((s) => s !== id),
    }));

  return (
    <>
      <SheetHeader>
        <SheetTitle>{initial.id ? "Hekimi düzenle" : "Yeni hekim"}</SheetTitle>
        <SheetDescription>Unvan asistanda açık söylenir: “Dt.” → “Diş Hekimi”.</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-6">
        <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <FormField label="Unvan">
            <Input
              list="practitioner-titles"
              value={value.title ?? ""}
              onChange={(event) => setValue((v) => ({ ...v, title: event.target.value || null }))}
              maxLength={30}
            />
          </FormField>
          <datalist id="practitioner-titles">
            {TITLES.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>
          <FormField label="Ad soyad">
            <Input
              value={value.name}
              onChange={(event) => setValue((v) => ({ ...v, name: event.target.value }))}
              maxLength={100}
            />
          </FormField>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="practitioner-active"
            checked={value.isActive}
            onCheckedChange={(isActive) => setValue((v) => ({ ...v, isActive }))}
          />
          <Label htmlFor="practitioner-active">Randevu alabilir</Label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-heading">Verdiği hizmetler</legend>
          <p className="text-xs text-body">Hiçbiri seçilmezse tüm hizmetleri verir.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((service) => (
              <div key={service.id} className="flex items-center gap-2.5">
                <Checkbox
                  id={`service-${service.id}`}
                  checked={value.serviceIds.includes(service.id)}
                  onCheckedChange={(on) => toggleService(service.id, on === true)}
                />
                <Label htmlFor={`service-${service.id}`} className="font-normal">
                  {service.name}
                  {!service.isActive && <span className="text-body"> (pasif)</span>}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-heading">Çalışma saatleri</legend>
          <div className="flex items-center gap-3">
            <Switch
              id="own-hours"
              checked={ownHours}
              onCheckedChange={(on) => {
                setOwnHours(on);
                if (!on) setValue((v) => ({ ...v, hours: [] }));
              }}
            />
            <Label htmlFor="own-hours">Klinik saatlerinden farklı çalışıyor</Label>
          </div>
          {ownHours && (
            <WeeklyHoursEditor
              value={value.hours}
              onChange={(hours) => setValue((v) => ({ ...v, hours }))}
            />
          )}
        </fieldset>
      </div>
      <SheetFooter>
        <SaveButton
          pending={pending}
          onClick={() => save(() => savePractitionerSettings(value), onSaved)}
        />
      </SheetFooter>
    </>
  );
}
