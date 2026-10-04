"use client";

import { CalendarPlus, LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import type { FormState } from "@/lib/contracts/form-state";
import type { CreateAppointmentField } from "@/lib/contracts/panel-appointment";
import { formatShortDate } from "@/lib/format";

import { createAppointment, getAvailableSlots, type SlotOption } from "./actions";

export interface BookingOptions {
  services: { id: string; name: string; durationMinutes: number }[];
  practitioners: { id: string; name: string }[];
  /** Clinic-local today, as the earliest selectable date. */
  today: string;
}

const ANY_PRACTITIONER = "any";

/** "Yeni randevu": service → practitioner → date → free slot → patient. */
export function NewAppointmentDialog({
  options,
  defaultDate,
  trigger,
}: {
  options: BookingOptions;
  defaultDate?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <CalendarPlus data-icon="inline-start" />
            Yeni randevu
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Yeni randevu</DialogTitle>
          <DialogDescription>
            Uygun saatler kliniğin ve hekimin çalışma saatlerine göre hesaplanır.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <BookingForm
            options={options}
            defaultDate={defaultDate ?? options.today}
            onDone={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BookingForm({
  options,
  defaultDate,
  onDone,
}: {
  options: BookingOptions;
  defaultDate: string;
  onDone: () => void;
}) {
  const [initialQuery] = useState(() => ({
    serviceId: options.services[0]?.id ?? "",
    practitionerId: ANY_PRACTITIONER,
    date: defaultDate,
  }));
  const [serviceId, setServiceId] = useState(initialQuery.serviceId);
  const [practitionerId, setPractitionerId] = useState(ANY_PRACTITIONER);
  const [date, setDate] = useState(defaultDate);
  const [slot, setSlot] = useState<SlotOption | null>(null);
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [nextDates, setNextDates] = useState<string[]>([]);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const [state, action, pending] = useActionState<FormState<CreateAppointmentField>, FormData>(
    createAppointment,
    { status: "idle" },
  );
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Randevu oluşturuldu.");
      onDone();
    }
  }, [state, onDone]);

  const fetchSlots = async (next: { serviceId: string; practitionerId: string; date: string }) => {
    const result = await getAvailableSlots({
      serviceId: next.serviceId,
      date: next.date,
      practitionerId: next.practitionerId === ANY_PRACTITIONER ? undefined : next.practitionerId,
    });
    setSlots(result.ok ? result.slots : []);
    setNextDates(result.ok ? result.nextAvailableDates : []);
    setSlotError(result.ok ? null : result.message);
  };
  const loadSlots = (next: { serviceId: string; practitionerId: string; date: string }) => {
    setSlot(null);
    if (!next.serviceId || !next.date) return;
    startLoading(() => fetchSlots(next));
  };
  const query = { serviceId, practitionerId, date };
  const changeService = (value: string) => {
    setServiceId(value);
    loadSlots({ ...query, serviceId: value });
  };
  const changePractitioner = (value: string) => {
    setPractitionerId(value);
    loadSlots({ ...query, practitionerId: value });
  };
  const changeDate = (value: string) => {
    setDate(value);
    loadSlots({ ...query, date: value });
  };

  // Slots for the initial selection; later changes reload from the handlers above.
  useEffect(() => {
    if (initialQuery.serviceId) startLoading(() => fetchSlots(initialQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  const showPractitioner = practitionerId === ANY_PRACTITIONER;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.status === "error" && !state.fieldErrors && (
        <p role="alert" className="rounded-card-sm bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.message}
        </p>
      )}
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="practitionerId" value={slot?.practitionerId ?? ""} />
      <input type="hidden" name="time" value={slot?.time ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Hizmet" error={errors.serviceId}>
          {(field) => (
            <Select value={serviceId} onValueChange={changeService}>
              <SelectTrigger {...field} className="w-full">
                <SelectValue placeholder="Hizmet seçin">
                  {options.services.find((service) => service.id === serviceId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {options.services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} · {service.durationMinutes} dk
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField label="Hekim">
          {(field) => (
            <Select value={practitionerId} onValueChange={changePractitioner}>
              <SelectTrigger {...field} className="w-full">
                <SelectValue>
                  {practitionerId === ANY_PRACTITIONER
                    ? "Fark etmez"
                    : options.practitioners.find((p) => p.id === practitionerId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_PRACTITIONER}>Fark etmez</SelectItem>
                {options.practitioners.map((practitioner) => (
                  <SelectItem key={practitioner.id} value={practitioner.id}>
                    {practitioner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField label="Tarih" error={errors.date} className="sm:col-span-2">
          <Input
            name="date"
            type="date"
            min={options.today}
            value={date}
            onChange={(event) => changeDate(event.target.value)}
            required
          />
        </FormField>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium text-heading">Uygun saatler</legend>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-body">
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
            Saatler yükleniyor
          </p>
        ) : slotError ? (
          <p className="text-sm text-danger">{slotError}</p>
        ) : slots.length === 0 ? (
          <div className="flex flex-col gap-2 text-sm text-body">
            <p>Bu tarihte uygun saat yok.</p>
            {nextDates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {nextDates.map((next) => (
                  <Button
                    key={next}
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={() => changeDate(next)}
                  >
                    {formatShortDate(next)}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
            {slots.map((option) => {
              const selected =
                slot?.time === option.time && slot.practitionerId === option.practitionerId;
              return (
                <button
                  key={`${option.time}-${option.practitionerId}`}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${option.time}, ${option.practitionerName}`}
                  onClick={() => setSlot(option)}
                  className={cn(
                    "flex flex-col items-center rounded-card-sm border px-2 py-2 text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary text-on-dark"
                      : "border-hairline bg-paper text-heading hover:border-primary",
                  )}
                >
                  <span className="font-semibold tabular-nums">{option.time}</span>
                  {showPractitioner && (
                    <span
                      className={cn(
                        "max-w-full truncate text-[11px]",
                        selected ? "text-on-dark-soft" : "text-body",
                      )}
                    >
                      {option.practitionerName}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {(errors.time || errors.practitionerId) && (
          <p className="text-xs font-medium text-danger">{errors.time ?? errors.practitionerId}</p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Hasta adı soyadı" error={errors.patientName}>
          <Input name="patientName" autoComplete="off" required />
        </FormField>
        <FormField label="Telefon" error={errors.patientPhone}>
          <Input
            name="patientPhone"
            type="tel"
            inputMode="tel"
            placeholder="0532 123 45 67"
            required
          />
        </FormField>
        <FormField label="Not (isteğe bağlı)" error={errors.notes} className="sm:col-span-2">
          <Textarea name="notes" maxLength={500} className="min-h-20" />
        </FormField>
      </div>

      <Button type="submit" size="lg" disabled={pending || !slot}>
        {pending && <LoaderCircle className="animate-spin" />}
        {slot ? `Randevuyu oluştur · ${formatShortDate(date)} ${slot.time}` : "Önce bir saat seçin"}
      </Button>
    </form>
  );
}
