"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";

import { FormField } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AssistantSettingsInput } from "@/lib/contracts/settings";

import { saveAssistantSettings, syncAssistant } from "../actions";
import { SaveButton, SettingsCard, useSave } from "../_components/settings-ui";

type FormValue = Omit<AssistantSettingsInput, "greeting" | "extraInstructions"> & {
  greeting: string;
  extraInstructions: string;
};

export function SyncStatusCard({
  status,
  editable,
}: {
  status: {
    status: "pending" | "synced" | "error";
    syncedAt: Date | null;
    lastError: string | null;
  } | null;
  editable: boolean;
}) {
  const { pending, save } = useSave();
  const when = status?.syncedAt
    ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(
        status.syncedAt,
      )
    : null;

  const state = !status
    ? {
        icon: CircleAlert,
        tone: "text-body",
        text: "Bu klinik için sesli asistan henüz kurulmadı. Kurulumu Recall ekibi yapar.",
      }
    : status.status === "synced"
      ? {
          icon: CheckCircle2,
          tone: "text-success",
          text: `Asistan güncel${when ? ` · son güncelleme ${when}` : ""}`,
        }
      : status.status === "error"
        ? {
            icon: CircleAlert,
            tone: "text-danger",
            text: "Son güncelleme başarısız oldu. Recall ekibi bilgilendirildi.",
          }
        : { icon: LoaderCircle, tone: "text-primary", text: "Değişiklikler asistana aktarılıyor." };
  const Icon = state.icon;

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-paper px-6 py-4">
      <p className={`flex items-center gap-2 text-sm font-medium ${state.tone}`}>
        <Icon aria-hidden className="size-4" />
        {state.text}
      </p>
      {status && editable && (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => save(syncAssistant)}>
          {pending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
          Şimdi güncelle
        </Button>
      )}
    </section>
  );
}

export function AssistantForm({ initial, editable }: { initial: FormValue; editable: boolean }) {
  const [value, setValue] = useState(initial);
  const { pending, save } = useSave();
  const update = (patch: Partial<FormValue>) => setValue((current) => ({ ...current, ...patch }));
  const updateFaq = (index: number, patch: Partial<FormValue["faq"][number]>) =>
    update({ faq: value.faq.map((item, i) => (i === index ? { ...item, ...patch } : item)) });

  return (
    <>
      <SettingsCard
        title="Asistan"
        description="Asistanın kendini nasıl tanıttığı ve nasıl davrandığı."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Asistanın adı" hint="Arayanlara kendini bu adla tanıtır.">
            <Input
              value={value.name}
              onChange={(event) => update({ name: event.target.value })}
              disabled={!editable}
              maxLength={40}
            />
          </FormField>
        </div>
        <FormField
          label="Karşılama cümlesi (isteğe bağlı)"
          hint="Boş bırakılırsa: “{Klinik adı}, merhaba! Ben {asistan adı}, kliniğin dijital asistanıyım.” Sonuna kayıt bilgilendirmesi ve “Size nasıl yardımcı olabilirim?” eklenir."
        >
          <Textarea
            value={value.greeting}
            onChange={(event) => update({ greeting: event.target.value })}
            disabled={!editable}
            maxLength={300}
            className="min-h-20"
          />
        </FormField>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Switch
              id="speakPrices"
              checked={value.speakPrices}
              onCheckedChange={(speakPrices) => update({ speakPrices })}
              disabled={!editable}
            />
            <Label htmlFor="speakPrices">Sorulduğunda fiyat aralığını söylesin</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="recordCalls"
              checked={value.recordCalls}
              onCheckedChange={(recordCalls) => update({ recordCalls })}
              disabled={!editable}
            />
            <Label htmlFor="recordCalls">
              Aramaları kaydet (arayana KVKK bilgilendirmesi yapılır)
            </Label>
          </div>
        </div>
        <FormField
          label="Ek talimatlar (isteğe bağlı)"
          hint="Kliniğe özel kurallar. Örn: “İmplant soran hastalara önce implant görüşmesi randevusu öner.” Asistan tıbbi tavsiye vermez."
        >
          <Textarea
            value={value.extraInstructions}
            onChange={(event) => update({ extraInstructions: event.target.value })}
            disabled={!editable}
            maxLength={1000}
          />
        </FormField>
      </SettingsCard>

      <SettingsCard
        title="Sık sorulan sorular"
        description="Asistan bu sorulara buradaki cevaplarla yanıt verir. En fazla 20 soru."
        footer={
          editable && (
            <>
              <Button
                variant="outline"
                disabled={value.faq.length >= 20}
                onClick={() => update({ faq: [...value.faq, { q: "", a: "" }] })}
              >
                <Plus data-icon="inline-start" />
                Soru ekle
              </Button>
              <SaveButton
                pending={pending}
                onClick={() =>
                  save(() =>
                    saveAssistantSettings({
                      ...value,
                      faq: value.faq.filter((item) => item.q.trim() || item.a.trim()),
                    }),
                  )
                }
              >
                Asistan ayarlarını kaydet
              </SaveButton>
            </>
          )
        }
      >
        {value.faq.length === 0 && <p className="text-sm text-body">Henüz soru eklenmedi.</p>}
        <ol className="flex flex-col gap-4">
          {value.faq.map((item, index) => (
            <li key={index} className="flex gap-3 rounded-card-sm bg-canvas p-4">
              <span className="pt-2 text-sm font-semibold text-body tabular-nums">
                {index + 1}.
              </span>
              <div className="flex flex-1 flex-col gap-3">
                <FormField label="Soru">
                  <Input
                    value={item.q}
                    onChange={(event) => updateFaq(index, { q: event.target.value })}
                    disabled={!editable}
                    maxLength={200}
                  />
                </FormField>
                <FormField label="Cevap">
                  <Textarea
                    value={item.a}
                    onChange={(event) => updateFaq(index, { a: event.target.value })}
                    disabled={!editable}
                    maxLength={500}
                    className="min-h-16"
                  />
                </FormField>
              </div>
              {editable && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${index + 1}. soruyu sil`}
                  onClick={() => update({ faq: value.faq.filter((_, i) => i !== index) })}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ol>
      </SettingsCard>
    </>
  );
}
