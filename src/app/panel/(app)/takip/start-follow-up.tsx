"use client";

import { Repeat } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Switch } from "@/components/ui/switch";

import { startFollowUp } from "./actions";

export interface StartRule {
  id: string;
  name: string;
  triggerServiceId: string | null;
}

/** "Takibe al": from an appointment (first visit) or from a patient (a start date). */
export function StartFollowUpButton({
  rules,
  patientId,
  appointment,
  today,
}: {
  rules: StartRule[];
  patientId: string;
  appointment: { id: string; serviceId: string } | null;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const preferred =
    rules.find((r) => appointment && r.triggerServiceId === appointment.serviceId) ?? rules[0];
  const [ruleId, setRuleId] = useState(preferred?.id ?? "");
  const [startedOn, setStartedOn] = useState(today);
  const [consent, setConsent] = useState(false);
  const [pending, startTransition] = useTransition();

  if (rules.length === 0) {
    return (
      <p className="text-sm text-body">
        Takip başlatmak için Ayarlar → Takip kurallarından bir kural etkinleştirin.
      </p>
    );
  }

  const submit = () =>
    startTransition(async () => {
      const result = await startFollowUp({
        ruleId,
        patientId,
        appointmentId: appointment?.id ?? null,
        startedOn: appointment ? null : startedOn,
        smsConsent: consent,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      if (result.planId) router.push(`/panel/takip/${result.planId}`);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Repeat data-icon="inline-start" />
          Takibe al
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Takibe al</DialogTitle>
          <DialogDescription>
            {appointment
              ? "Bu randevu takibin ilk ziyareti olur; sonraki tarih kurala göre hesaplanır."
              : "Takip, seçtiğiniz günden itibaren kurala göre hesaplanır."}
          </DialogDescription>
        </DialogHeader>
        <FormField label="Kural">
          {(field) => (
            <Select value={ruleId} onValueChange={setRuleId}>
              <SelectTrigger {...field} className="w-full">
                <SelectValue>{rules.find((r) => r.id === ruleId)?.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {rules.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        {!appointment && (
          <FormField label="Başlangıç günü">
            <Input type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} />
          </FormField>
        )}
        <label className="flex items-center gap-3 text-sm text-heading">
          <Switch checked={consent} onCheckedChange={setConsent} />
          Hasta SMS hatırlatmasını kabul etti
        </label>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Vazgeç</Button>
          </DialogClose>
          <Button onClick={submit} disabled={pending || !ruleId || (!appointment && !startedOn)}>
            Takibi başlat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
