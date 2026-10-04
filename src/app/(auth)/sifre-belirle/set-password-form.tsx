"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SetPasswordField } from "@/lib/contracts/auth";
import type { FormState } from "@/lib/contracts/form-state";

import { setPassword } from "../actions";
import { FormMessage } from "../_components/auth-ui";

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState<SetPasswordField>, FormData>(
    setPassword,
    { status: "idle" },
  );
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <FormField label="Yeni parola" error={errors.password} hint="En az 10 karakter">
        <Input name="password" type="password" autoComplete="new-password" required autoFocus />
      </FormField>
      <FormField label="Yeni parola (tekrar)" error={errors.passwordRepeat}>
        <Input name="passwordRepeat" type="password" autoComplete="new-password" required />
      </FormField>
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" />}
        Parolayı kaydet
      </Button>
      {state.status === "error" && !state.fieldErrors && (
        <Link
          href="/sifremi-unuttum"
          className="text-center text-sm font-medium text-primary hover:underline"
        >
          Yeni bağlantı iste
        </Link>
      )}
    </form>
  );
}
