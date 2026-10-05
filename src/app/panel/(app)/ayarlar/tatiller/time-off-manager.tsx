"use client";

import { CalendarOff, Flag, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { EmptyState, FormField } from "@/components/panel";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { addPublicHolidayEntries, addTimeOffEntry, removeTimeOffEntry } from "../actions";
import { SaveButton, SettingsCard, useSave } from "../_components/settings-ui";

const CLINIC = "clinic";

interface Entry {
  id: string;
  who: string;
  when: string;
  reason: string | null;
}

export function TimeOffManager({
  entries,
  practitioners,
  years,
  editable,
}: {
  entries: Entry[];
  practitioners: { id: string; name: string }[];
  years: number[];
  editable: boolean;
}) {
  const { pending, save } = useSave();

  return (
    <>
      <SettingsCard
        title="Tatil ve izinler"
        description="Bu günlerde asistan ve panel randevu önermez. Mevcut randevular otomatik iptal edilmez; çakışma varsa uyarılırsınız."
        footer={
          editable && (
            <>
              {years.map((year) => (
                <Button
                  key={year}
                  variant="outline"
                  disabled={pending}
                  onClick={() => save(() => addPublicHolidayEntries(year))}
                >
                  <Flag data-icon="inline-start" />
                  {year} resmî tatillerini ekle
                </Button>
              ))}
              <AddTimeOffDialog practitioners={practitioners} />
            </>
          )
        }
      >
        {entries.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="Yaklaşan kapalı gün yok"
            description="Resmî tatilleri tek tıkla ekleyebilir, hekim izinlerini girebilirsiniz."
            className="border-0"
          />
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium text-heading">{entry.when}</span>
                  <span className="text-xs text-body">
                    {entry.who}
                    {entry.reason && ` · ${entry.reason}`}
                  </span>
                </span>
                {editable && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Sil"
                    disabled={pending}
                    onClick={() => save(() => removeTimeOffEntry(entry.id))}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
    </>
  );
}

function AddTimeOffDialog({ practitioners }: { practitioners: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState(CLINIC);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [partial, setPartial] = useState(false);
  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("18:00");
  const [reason, setReason] = useState("");
  const { pending, save } = useSave();

  const submit = () =>
    save(
      () =>
        addTimeOffEntry({
          practitionerId: who === CLINIC ? null : who,
          startDate,
          endDate: partial ? startDate : endDate || startDate,
          startTime: partial ? startTime : null,
          endTime: partial ? endTime : null,
          reason,
        }),
      () => {
        setOpen(false);
        setStartDate("");
        setEndDate("");
        setReason("");
      },
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Kapalı gün / izin ekle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kapalı gün veya izin</DialogTitle>
          <DialogDescription>
            Tüm klinik kapalıysa ya da bir hekim izinliyse ekleyin.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormField label="Kim için?">
            {(field) => (
              <Select value={who} onValueChange={setWho}>
                <SelectTrigger {...field} className="w-full">
                  <SelectValue>
                    {who === CLINIC ? "Tüm klinik" : practitioners.find((p) => p.id === who)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CLINIC}>Tüm klinik</SelectItem>
                  {practitioners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <div className="flex items-center gap-3">
            <Switch id="partial-day" checked={partial} onCheckedChange={setPartial} />
            <Label htmlFor="partial-day">Günün yalnızca bir kısmı</Label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={partial ? "Tarih" : "Başlangıç"}>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </FormField>
            {partial ? (
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Saat">
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                </FormField>
                <FormField label="Bitiş">
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                  />
                </FormField>
              </div>
            ) : (
              <FormField label="Bitiş (dahil)" hint="Tek gün için boş bırakın.">
                <Input
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </FormField>
            )}
          </div>
          <FormField label="Açıklama (isteğe bağlı)">
            <Input
              value={reason}
              maxLength={120}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        </div>
        <DialogFooter>
          <SaveButton pending={pending} disabled={!startDate} onClick={submit}>
            Ekle
          </SaveButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
