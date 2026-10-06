"use client";

import { Archive, Copy, Pencil, Plus, Sparkles } from "lucide-react";
import { useState } from "react";

import { FormField } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  addIntervalToDate,
  describeRule,
  FOLLOW_UP_INTERVAL_UNITS,
  INTERVAL_UNIT_LABELS,
  type FollowUpIntervalUnit,
} from "@/lib/contracts/follow-up";
import { formatLongDate } from "@/lib/format";

import { SaveButton, SettingsCard, useSave } from "../_components/settings-ui";
import {
  addFollowUpExamples,
  archiveFollowUpRule,
  duplicateFollowUpRule,
  saveFollowUpRule,
  saveFollowUpSettings,
} from "../../takip/actions";

interface Rule {
  id: string;
  name: string;
  triggerServiceId: string | null;
  triggerServiceName: string | null;
  visitServiceId: string;
  visitServiceName: string;
  intervalValue: number | null;
  intervalUnit: FollowUpIntervalUnit | null;
  totalVisits: number | null;
  smsReminders: boolean;
  isActive: boolean;
  templateKey: string | null;
  openPlans: number;
}

interface Draft {
  id: string | null;
  name: string;
  triggerServiceId: string | null;
  visitServiceId: string;
  intervalValue: string;
  intervalUnit: FollowUpIntervalUnit;
  indefinite: boolean;
  totalVisits: string;
  smsReminders: boolean;
  isActive: boolean;
  openPlans: number;
  example: boolean;
}

const NONE = "none";
// Preview anchor: a fixed, neutral example date.
const EXAMPLE_FROM = "2026-01-10";

export function FollowUpRules({
  editable,
  rules,
  services,
  templates,
}: {
  editable: boolean;
  rules: Rule[];
  services: { id: string; name: string }[];
  templates: { key: string; label: string }[];
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [archiving, setArchiving] = useState<Rule | null>(null);
  const [template, setTemplate] = useState(templates[0]?.key ?? "");
  const { pending, save } = useSave();
  const nameOf = (id: string | null) => services.find((s) => s.id === id)?.name ?? null;

  const edit = (rule: Rule) =>
    setDraft({
      id: rule.id,
      name: rule.name,
      triggerServiceId: rule.triggerServiceId,
      visitServiceId: rule.visitServiceId,
      intervalValue: rule.intervalValue ? String(rule.intervalValue) : "",
      intervalUnit: rule.intervalUnit ?? "month",
      indefinite: rule.totalVisits === null,
      totalVisits: rule.totalVisits ? String(rule.totalVisits) : "",
      smsReminders: rule.smsReminders,
      isActive: rule.isActive,
      openPlans: rule.openPlans,
      example: rule.templateKey !== null,
    });

  return (
    <>
      <SettingsCard
        title="Takip kuralları"
        description="Hangi hizmetten sonra hastanın ne sıklıkla tekrar gelmesi gerektiğini tanımlayın. Kuralı değiştirmek mevcut takipleri etkilemez; yeni takipler güncel kuralla başlar."
        footer={
          editable && (
            <Button
              variant="outline"
              onClick={() =>
                setDraft({
                  id: null,
                  name: "",
                  triggerServiceId: null,
                  visitServiceId: services[0]?.id ?? "",
                  intervalValue: "",
                  intervalUnit: "month",
                  indefinite: true,
                  totalVisits: "",
                  smsReminders: false,
                  isActive: false,
                  openPlans: 0,
                  example: false,
                })
              }
            >
              <Plus data-icon="inline-start" />
              Yeni kural
            </Button>
          )
        }
      >
        {rules.length === 0 ? (
          <p className="text-sm text-body">
            Henüz kural yok. Yeni bir kural oluşturun ya da aşağıdan sektörünüze göre örnek ekleyin.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2 font-medium text-heading">
                    {rule.name}
                    {rule.isActive ? (
                      <Badge variant="success">Etkin</Badge>
                    ) : (
                      <Badge variant="secondary">Pasif</Badge>
                    )}
                    {rule.templateKey && (
                      <Badge variant="dashed">
                        Örnek şablon · düzenlenebilir · tıbbi öneri değildir
                      </Badge>
                    )}
                  </span>
                  <span className="text-sm text-body">{describeRule(rule)}</span>
                  <span className="text-xs text-body">
                    {rule.openPlans} açık takip · SMS hatırlatma{" "}
                    {rule.smsReminders ? "açık" : "kapalı"}
                  </span>
                </span>
                {editable && (
                  <span className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Düzenle"
                      onClick={() => edit(rule)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Kopyala"
                      disabled={pending}
                      onClick={() => save(() => duplicateFollowUpRule(rule.id))}
                    >
                      <Copy />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Arşivle"
                      onClick={() => setArchiving(rule)}
                    >
                      <Archive />
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>

      {editable && (
        <SettingsCard
          title="Örnek kurallar"
          description="Sektörünüz için hazır kural taslakları. Aralıklar boş gelir: klinik ekibiniz belirler. Örnekler tıbbi öneri değildir ve siz etkinleştirene kadar pasif kalır."
          footer={
            <SaveButton
              pending={pending}
              disabled={!template}
              onClick={() => save(() => addFollowUpExamples(template))}
            >
              <Sparkles />
              Örnekleri ekle
            </SaveButton>
          }
        >
          <FormField label="Sektör">
            {(field) => (
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger {...field} className="w-full sm:w-72">
                  <SelectValue>{templates.find((t) => t.key === template)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
        </SettingsCard>
      )}

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          {draft && (
            <RuleEditor
              key={draft.id ?? "new"}
              initial={draft}
              services={services}
              nameOf={nameOf}
              onDone={() => setDraft(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={archiving !== null} onOpenChange={(open) => !open && setArchiving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{archiving?.name} arşivlensin mi?</DialogTitle>
            <DialogDescription>
              Kural listeden kalkar ve yeni takip başlatılamaz.{" "}
              {archiving && archiving.openPlans > 0
                ? `${archiving.openPlans} açık takip kendi kopyasıyla devam eder.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Vazgeç</Button>
            </DialogClose>
            <SaveButton
              pending={pending}
              onClick={() =>
                archiving &&
                save(
                  () => archiveFollowUpRule(archiving.id),
                  () => setArchiving(null),
                )
              }
            >
              Arşivle
            </SaveButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RuleEditor({
  initial,
  services,
  nameOf,
  onDone,
}: {
  initial: Draft;
  services: { id: string; name: string }[];
  nameOf: (id: string | null) => string | null;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const { pending, save } = useSave();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const interval = Number(draft.intervalValue) || null;
  const total = draft.indefinite ? null : Number(draft.totalVisits) || null;
  const sentence = describeRule({
    triggerServiceName: nameOf(draft.triggerServiceId),
    visitServiceName: nameOf(draft.visitServiceId) ?? "—",
    intervalValue: interval,
    intervalUnit: interval ? draft.intervalUnit : null,
    totalVisits: total,
  });
  const preview = interval
    ? [1, 2, 3]
        .slice(0, total ? Math.max(0, Math.min(3, total - 1)) : 3)
        .reduce<string[]>((dates) => {
          const from = dates.at(-1) ?? EXAMPLE_FROM;
          return [...dates, addIntervalToDate(from, interval, draft.intervalUnit)];
        }, [])
    : [];

  return (
    <>
      <DialogHeader>
        <DialogTitle>{initial.id ? "Kuralı düzenle" : "Yeni takip kuralı"}</DialogTitle>
        <DialogDescription>
          {initial.id && initial.openPlans > 0
            ? `${initial.openPlans} açık takip kendi kopyasıyla devam eder; değişiklik yalnızca yeni takipleri etkiler.`
            : "Cümleyi tamamlayın; önizleme altta."}
        </DialogDescription>
      </DialogHeader>

      <FormField label="Kural adı">
        <Input value={draft.name} maxLength={60} onChange={(e) => set("name", e.target.value)} />
      </FormField>

      <div className="flex flex-col gap-3 rounded-card-sm border border-hairline bg-canvas p-4 text-sm text-heading">
        <div className="flex flex-wrap items-center gap-2">
          <ServiceSelect
            value={draft.triggerServiceId ?? NONE}
            services={services}
            allowNone
            onChange={(v) => set("triggerServiceId", v === NONE ? null : v)}
            label="Başlatan hizmet"
          />
          <span>sonrasında hastayı her</span>
          <Input
            aria-label="Aralık"
            type="number"
            min={1}
            className="w-20"
            value={draft.intervalValue}
            onChange={(e) => set("intervalValue", e.target.value)}
          />
          <Select
            value={draft.intervalUnit}
            onValueChange={(v) => set("intervalUnit", v as FollowUpIntervalUnit)}
          >
            <SelectTrigger aria-label="Birim" className="w-28">
              <SelectValue>{INTERVAL_UNIT_LABELS[draft.intervalUnit]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FOLLOW_UP_INTERVAL_UNITS.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {INTERVAL_UNIT_LABELS[unit]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>bir takip et,</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={draft.indefinite ? "indefinite" : "total"}
            onValueChange={(v) => set("indefinite", v === "indefinite")}
          >
            <SelectTrigger aria-label="Süre" className="w-36">
              <SelectValue>{draft.indefinite ? "süresiz" : "toplam"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="indefinite">süresiz</SelectItem>
              <SelectItem value="total">toplam</SelectItem>
            </SelectContent>
          </Select>
          {!draft.indefinite && (
            <>
              <Input
                aria-label="Toplam ziyaret"
                type="number"
                min={1}
                max={50}
                className="w-20"
                value={draft.totalVisits}
                onChange={(e) => set("totalVisits", e.target.value)}
              />
              <span>ziyaret (ilk ziyaret dahil).</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span>Takip ziyareti:</span>
          <ServiceSelect
            value={draft.visitServiceId}
            services={services}
            onChange={(v) => set("visitServiceId", v)}
            label="Takip ziyareti hizmeti"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-heading">{sentence}</span>
        {preview.length > 0 ? (
          <span className="text-body">
            Örnek: {formatLongDate(EXAMPLE_FROM)} ziyaretinden sonra →{" "}
            {preview.map(formatLongDate).join(" → ")}
          </span>
        ) : (
          <span className="text-body">Aralık girilmeden kural etkinleştirilemez.</span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 text-sm text-heading">
          <Switch checked={draft.smsReminders} onCheckedChange={(v) => set("smsReminders", v)} />
          SMS hatırlatması gönder (hasta onayı ve klinik ayarı da gerekir)
        </label>
        <label className="flex items-center gap-3 text-sm text-heading">
          <Switch
            checked={draft.isActive}
            disabled={!interval}
            onCheckedChange={(v) => set("isActive", v)}
          />
          Etkin: yeni takipler bu kuralla başlatılabilir
        </label>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Vazgeç</Button>
        </DialogClose>
        <SaveButton
          pending={pending}
          disabled={!draft.name.trim() || !draft.visitServiceId}
          onClick={() =>
            save(
              () =>
                saveFollowUpRule(initial.id, {
                  name: draft.name,
                  triggerServiceId: draft.triggerServiceId,
                  visitServiceId: draft.visitServiceId,
                  intervalValue: interval,
                  intervalUnit: interval ? draft.intervalUnit : null,
                  totalVisits: total,
                  smsReminders: draft.smsReminders,
                  isActive: interval ? draft.isActive : false,
                }),
              onDone,
            )
          }
        />
      </DialogFooter>
    </>
  );
}

function ServiceSelect({
  value,
  services,
  onChange,
  allowNone,
  label,
}: {
  value: string;
  services: { id: string; name: string }[];
  onChange: (value: string) => void;
  allowNone?: boolean;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-56">
        <SelectValue>
          {value === NONE ? "Herhangi bir hizmet" : services.find((s) => s.id === value)?.name}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>Herhangi bir hizmet</SelectItem>}
        {services.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FollowUpSettingsCard({
  editable,
  initial,
}: {
  editable: boolean;
  initial: { smsReminders: boolean; dueSoonDays: number };
}) {
  const [value, setValue] = useState(initial);
  const { pending, save } = useSave();
  return (
    <SettingsCard
      title="Takip ayarları"
      description="SMS gönderimi henüz etkin değil; açıldığında yalnızca onay veren hastalara, en fazla iki hatırlatma gider."
      footer={
        editable && (
          <SaveButton pending={pending} onClick={() => save(() => saveFollowUpSettings(value))} />
        )
      }
    >
      <label className="flex items-center gap-3 text-sm text-heading">
        <Switch
          checked={value.smsReminders}
          disabled={!editable}
          onCheckedChange={(smsReminders) => setValue((v) => ({ ...v, smsReminders }))}
        />
        Takip hatırlatma SMS&apos;leri (klinik geneli)
      </label>
      <FormField
        label="“Zamanı geldi” sayılacak süre"
        hint="Sonraki tarihe bu kadar gün kala takip listede öne çıkar."
      >
        <Input
          type="number"
          min={1}
          max={60}
          className="w-28"
          disabled={!editable}
          value={value.dueSoonDays}
          onChange={(e) => setValue((v) => ({ ...v, dueSoonDays: Number(e.target.value) }))}
        />
      </FormField>
    </SettingsCard>
  );
}
