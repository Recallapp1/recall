"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SignInField } from "@/lib/contracts/auth";
import type { FormState } from "@/lib/contracts/form-state";

import { signIn } from "../actions";
import { FormMessage } from "../_components/auth-ui";

export function SignInForm({ next, passwordChanged }: { next: string; passwordChanged: boolean }) {
  const [state, action, pending] = useActionState<FormState<SignInField>, FormData>(
    signIn,
    passwordChanged
      ? {
          status: "success",
          message: "Parolanız kaydedildi. Yeni parolanızla giriş yapabilirsiniz.",
        }
      : { status: "idle" },
  );
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <FormMessage state={state} />
      <input type="hidden" name="sonra" value={next} />
      <FormField label="E-posta" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" required autoFocus />
      </FormField>
      <FormField label="Parola" error={errors.password}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </FormField>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Checkbox id="remember" name="remember" defaultChecked />
          <Label htmlFor="remember" className="font-normal text-body">
            Beni hatırla
          </Label>
        </div>
        <Link href="/sifremi-unuttum" className="text-sm font-medium text-primary hover:underline">
          Parolamı unuttum
        </Link>
      </div>
      <Button type="submit" size="lg" disabled={pending} className="mt-2">
        {pending && <LoaderCircle className="animate-spin" />}
        {pending ? "Giriş yapılıyor" : "Giriş yap"}
      </Button>
      <p className="text-center text-xs text-body">
        Hesabınız yok mu? Hesaplar kliniğinizin yöneticisinin davetiyle açılır.
      </p>
    </form>
  );
}
