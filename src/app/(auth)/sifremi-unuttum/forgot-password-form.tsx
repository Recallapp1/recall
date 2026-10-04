"use client";

import { ArrowLeft, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/contracts/form-state";

import { requestPasswordLink } from "../actions";
import { FormMessage } from "../_components/auth-ui";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState<"email">, FormData>(
    requestPasswordLink,
    { status: "idle" },
  );
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <FormMessage state={state} />
      {state.status !== "success" && (
        <>
          <FormField label="E-posta" error={errors.email}>
            <Input name="email" type="email" autoComplete="email" required autoFocus />
          </FormField>
          <Button type="submit" size="lg" disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" />}
            Bağlantı gönder
          </Button>
        </>
      )}
      <Link
        href="/giris"
        className="inline-flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Girişe dön
      </Link>
    </form>
  );
}
