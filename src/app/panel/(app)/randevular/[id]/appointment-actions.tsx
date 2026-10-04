"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
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
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_ACTION_LABELS, type AppointmentStatus } from "@/lib/contracts/appointment";
import type { FormState } from "@/lib/contracts/form-state";

import { saveAppointmentNotes, setAppointmentStatus } from "../actions";

export function StatusActions({
  appointmentId,
  transitions,
}: {
  appointmentId: string;
  transitions: readonly AppointmentStatus[];
}) {
  const [pending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const apply = (status: AppointmentStatus) =>
    startTransition(async () => {
      const result = await setAppointmentStatus({ appointmentId, status });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      setConfirmCancel(false);
    });

  return (
    <div className="flex flex-col gap-2">
      {transitions.map((status) =>
        status === "cancelled" ? (
          <Button
            key={status}
            variant="outline"
            disabled={pending}
            onClick={() => setConfirmCancel(true)}
            className="justify-start text-danger hover:bg-danger-soft hover:text-danger"
          >
            {STATUS_ACTION_LABELS[status]}
          </Button>
        ) : (
          <Button
            key={status}
            variant={status === "confirmed" ? "default" : "outline"}
            disabled={pending}
            onClick={() => apply(status)}
            className="justify-start"
          >
            {pending && <LoaderCircle className="animate-spin" />}
            {STATUS_ACTION_LABELS[status]}
          </Button>
        ),
      )}

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Randevu iptal edilsin mi?</DialogTitle>
            <DialogDescription>
              İptal edilen randevu geri alınamaz; saat başka hastalara açılır.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Vazgeç</Button>
            </DialogClose>
            <Button variant="destructive" disabled={pending} onClick={() => apply("cancelled")}>
              {pending && <LoaderCircle className="animate-spin" />}
              İptal et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AppointmentNotesForm({
  appointmentId,
  notes,
  editable,
}: {
  appointmentId: string;
  notes: string;
  editable: boolean;
}) {
  const [state, action, pending] = useActionState<FormState<"notes">, FormData>(
    async (previous, formData) => {
      const result = await saveAppointmentNotes(previous, formData);
      if (result.status === "success") toast.success(result.message ?? "Kaydedildi.");
      return result;
    },
    { status: "idle" },
  );
  const error = state.status === "error" ? (state.fieldErrors?.notes ?? state.message) : undefined;

  if (!editable) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="text-label text-body">Not</h2>
        <p className="text-sm text-heading">{notes || "Not yok."}</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <FormField label="Not" error={error} hint="Hastaya gösterilmez; yalnızca klinik ekibi görür.">
        <Textarea name="notes" defaultValue={notes} maxLength={500} />
      </FormField>
      <Button type="submit" variant="secondary" size="sm" disabled={pending} className="w-fit">
        {pending && <LoaderCircle className="animate-spin" />}
        Notu kaydet
      </Button>
    </form>
  );
}
