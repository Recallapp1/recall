"use client";

import { LoaderCircle, ShieldX } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/panel";
import { Switch } from "@/components/ui/switch";
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
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/contracts/form-state";

import { anonymizePatientAction, savePatientNotes, setSmsOptOut } from "../actions";

export function PatientNotesForm({
  patientId,
  notes,
  editable,
}: {
  patientId: string;
  notes: string;
  editable: boolean;
}) {
  const [state, action, pending] = useActionState<FormState<"notes">, FormData>(
    async (previous, formData) => {
      const result = await savePatientNotes(previous, formData);
      if (result.status === "success") toast.success(result.message ?? "Kaydedildi.");
      return result;
    },
    { status: "idle" },
  );

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
      <input type="hidden" name="patientId" value={patientId} />
      <FormField
        label="Hasta notu"
        error={state.status === "error" ? state.message : undefined}
        hint="Yalnızca klinik ekibi görür. Asistan bu notu kullanmaz."
      >
        <Textarea name="notes" defaultValue={notes} maxLength={1000} />
      </FormField>
      <Button type="submit" variant="secondary" size="sm" disabled={pending} className="w-fit">
        {pending && <LoaderCircle className="animate-spin" />}
        Notu kaydet
      </Button>
    </form>
  );
}

const CONFIRM_WORD = "ANONİMLEŞTİR";

export function AnonymizeButton({ patientId }: { patientId: string }) {
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const ready = confirm.trim().toLocaleUpperCase("tr") === CONFIRM_WORD;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-fit text-danger hover:bg-danger-soft hover:text-danger"
        >
          <ShieldX />
          Kişisel verileri sil
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hasta anonimleştirilsin mi?</DialogTitle>
          <DialogDescription>
            Bu işlem geri alınamaz. Onaylamak için kutuya <strong>{CONFIRM_WORD}</strong> yazın.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Onay"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="off"
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Vazgeç</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={!ready || pending}
            onClick={() =>
              startTransition(async () => {
                const result = await anonymizePatientAction(patientId);
                if (result && !result.ok) toast.error(result.message);
              })
            }
          >
            {pending && <LoaderCircle className="animate-spin" />}
            Kalıcı olarak sil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "SMS istemiyor": no reminder of any kind reaches this patient by SMS. */
export function SmsOptOutSwitch({
  patientId,
  optedOut,
  editable,
}: {
  patientId: string;
  optedOut: boolean;
  editable: boolean;
}) {
  const [value, setValue] = useState(optedOut);
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-3 text-sm text-heading">
      <Switch
        checked={value}
        disabled={!editable || pending}
        onCheckedChange={(next) =>
          startTransition(async () => {
            const result = await setSmsOptOut(patientId, next);
            if (result.ok) {
              setValue(next);
              toast.success(result.message);
            } else {
              toast.error(result.message);
            }
          })
        }
      />
      SMS istemiyor
    </label>
  );
}
