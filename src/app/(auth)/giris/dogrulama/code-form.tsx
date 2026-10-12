"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { FormField } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { verifySignInCode } from "../../two-factor-actions";

export function CodeForm({ next }: { next: string }) {
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const code = String(new FormData(event.currentTarget).get("code") ?? "");
        startTransition(async () => {
          const result = await verifySignInCode({ code, recovery, next });
          if (result && !result.ok) setError(result.message);
        });
      }}
    >
      <FormField
        label={recovery ? "Yedek kod" : "Doğrulama kodu"}
        error={error ?? undefined}
        hint={
          recovery
            ? "Kaydettiğiniz yedek kodlardan birini girin; her kod bir kez kullanılır."
            : "Kod her 30 saniyede değişir. Telefonunuzun saati doğru olmalı."
        }
      >
        <Input
          key={recovery ? "recovery" : "totp"}
          name="code"
          autoComplete="one-time-code"
          inputMode={recovery ? "text" : "numeric"}
          maxLength={recovery ? 20 : 6}
          required
          autoFocus
        />
      </FormField>
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" />}
        Doğrula
      </Button>
      <button
        type="button"
        className="text-center text-sm font-medium text-primary hover:underline"
        onClick={() => {
          setRecovery((value) => !value);
          setError(null);
        }}
      >
        {recovery ? "Uygulamadaki kodu kullan" : "Yedek kod kullan"}
      </button>
      <p className="text-center text-xs text-body">
        Telefonunuzu ve yedek kodlarınızı kaybettiyseniz klinik yöneticinize başvurun; Recall ekibi
        kliniği arayarak doğruladıktan sonra sıfırlar.
      </p>
    </form>
  );
}
