"use client";

import { ClipboardList, Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { EmptyState, FormField } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import type { ServiceInput } from "@/lib/contracts/settings";

import { saveServiceSettings } from "../actions";
import { SaveButton, SettingsCard, useSave } from "../_components/settings-ui";

const lira = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

function priceLabel(service: ServiceInput): string {
  const { priceMin: min, priceMax: max } = service;
  if (min === null && max === null) return "Fiyat girilmedi";
  if (min !== null && max !== null && min !== max)
    return `${lira.format(min / 100)} – ${lira.format(max / 100)}`;
  return lira.format((min ?? max)! / 100);
}

export function ServicesManager({
  services,
  editable,
  speakPrices,
}: {
  services: (ServiceInput & { id: string })[];
  editable: boolean;
  speakPrices: boolean;
}) {
  const [editing, setEditing] = useState<ServiceInput | null>(null);

  return (
    <SettingsCard
      title="Hizmetler"
      description={
        speakPrices
          ? "Asistan bu hizmetler için randevu verir ve fiyat aralığını söyler."
          : "Asistan bu hizmetler için randevu verir. Fiyat söylemesi Asistan ayarlarından açılabilir."
      }
      footer={
        editable && (
          <Button
            variant="outline"
            onClick={() =>
              setEditing({
                name: "",
                description: null,
                aliases: [],
                durationMinutes: 30,
                priceMin: null,
                priceMax: null,
                isActive: true,
              })
            }
          >
            <Plus data-icon="inline-start" />
            Hizmet ekle
          </Button>
        )
      }
    >
      {services.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Henüz hizmet yok" className="border-0" />
      ) : (
        <ul className="flex flex-col divide-y divide-hairline">
          {services.map((service) => (
            <li key={service.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-heading">{service.name}</span>
                <span className="text-xs text-body">
                  {service.durationMinutes} dk · {priceLabel(service)}
                  {service.aliases.length > 0 && ` · ${service.aliases.join(", ")}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!service.isActive && <Badge variant="secondary">Pasif</Badge>}
                {editable && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(service)}>
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
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {editing && (
            <ServiceEditor
              key={editing.id ?? "new"}
              initial={editing}
              onSaved={() => setEditing(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </SettingsCard>
  );
}

function ServiceEditor({ initial, onSaved }: { initial: ServiceInput; onSaved: () => void }) {
  const [value, setValue] = useState(initial);
  const [aliases, setAliases] = useState(initial.aliases.join(", "));
  const toLira = (kurus: number | null) => (kurus === null ? "" : String(kurus / 100));
  const [prices, setPrices] = useState({
    min: toLira(initial.priceMin),
    max: toLira(initial.priceMax),
  });
  const { pending, save } = useSave();

  const submit = () => {
    const toKurus = (text: string) => {
      const number = Number(text.replace(",", "."));
      return text.trim() === "" || !Number.isFinite(number) ? null : Math.round(number * 100);
    };
    save(
      () =>
        saveServiceSettings({
          ...value,
          aliases: aliases
            .split(",")
            .map((alias) => alias.trim())
            .filter(Boolean),
          priceMin: toKurus(prices.min),
          priceMax: toKurus(prices.max),
        }),
      onSaved,
    );
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>{initial.id ? "Hizmeti düzenle" : "Yeni hizmet"}</SheetTitle>
        <SheetDescription>Süre, takvimde ayrılacak zamanı belirler.</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-6">
        <FormField label="Hizmet adı">
          <Input
            value={value.name}
            onChange={(event) => setValue((v) => ({ ...v, name: event.target.value }))}
            maxLength={100}
          />
        </FormField>
        <FormField
          label="Hastaların kullandığı diğer adlar"
          hint="Virgülle ayırın. Asistan konuşmada bu kelimeleri bu hizmetle eşleştirir. Örn: temizlik, taş"
        >
          <Input value={aliases} onChange={(event) => setAliases(event.target.value)} />
        </FormField>
        <FormField label="Açıklama (isteğe bağlı)">
          <Textarea
            value={value.description ?? ""}
            onChange={(event) =>
              setValue((v) => ({ ...v, description: event.target.value || null }))
            }
            maxLength={300}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Süre (dk)">
            <Input
              type="number"
              min={5}
              max={480}
              value={Number.isFinite(value.durationMinutes) ? value.durationMinutes : ""}
              onChange={(event) =>
                setValue((v) => ({ ...v, durationMinutes: event.target.valueAsNumber }))
              }
            />
          </FormField>
          <FormField label="En düşük (₺)">
            <Input
              inputMode="decimal"
              value={prices.min}
              onChange={(event) => setPrices((p) => ({ ...p, min: event.target.value }))}
            />
          </FormField>
          <FormField label="En yüksek (₺)">
            <Input
              inputMode="decimal"
              value={prices.max}
              onChange={(event) => setPrices((p) => ({ ...p, max: event.target.value }))}
            />
          </FormField>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="service-active"
            checked={value.isActive}
            onCheckedChange={(isActive) => setValue((v) => ({ ...v, isActive }))}
          />
          <Label htmlFor="service-active">Randevu verilebilir</Label>
        </div>
      </div>
      <SheetFooter>
        <SaveButton pending={pending} onClick={submit} />
      </SheetFooter>
    </>
  );
}
