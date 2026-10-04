"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { FormField } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AcceptInvitationField } from "@/lib/contracts/auth";
import type { FormState } from "@/lib/contracts/form-state";

import { acceptInvitationAsMember, acceptInvitationWithNewAccount } from "../../actions";
import { FormMessage } from "../../_components/auth-ui";

export function NewAccountForm({ invitationId }: { invitationId: string }) {
  const [state, action, pending] = useActionState<FormState<AcceptInvitationField>, FormData>(
    acceptInvitationWithNewAccount,
    { status: "idle" },
  );
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <FormMessage state={state} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <FormField label="Ad soyad" error={errors.name}>
        <Input name="name" autoComplete="name" required autoFocus />
      </FormField>
      <FormField label="Parola" error={errors.password} hint="En az 10 karakter">
        <Input name="password" type="password" autoComplete="new-password" required />
      </FormField>
      <FormField label="Parola (tekrar)" error={errors.passwordRepeat}>
        <Input name="passwordRepeat" type="password" autoComplete="new-password" required />
      </FormField>
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" />}
        Hesabımı oluştur ve katıl
      </Button>
    </form>
  );
}

export function AcceptAsMemberForm({ invitationId }: { invitationId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(acceptInvitationAsMember, {
    status: "idle",
  });

  return (
    <form action={action} className="flex flex-col gap-5">
      <FormMessage state={state} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" />}
        Daveti kabul et
      </Button>
    </form>
  );
}
