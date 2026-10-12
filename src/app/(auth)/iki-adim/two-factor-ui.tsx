"use client";

import { Download, LoaderCircle, Printer } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { FormField } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  confirmTwoFactorEnrolment,
  disableTwoFactor,
  regenerateRecoveryCodes,
  startTwoFactorEnrolment,
} from "../two-factor-actions";

/** Recovery codes, shown once: download, print, and a tick before going on. */
function RecoveryCodes({
  codes,
  onDone,
  doneLabel = "Tamam",
}: {
  codes: string[];
  onDone: () => void;
  doneLabel?: string;
}) {
  const [saved, setSaved] = useState(false);
  const download = () => {
    const text = `Recall yedek kodları\nHer kod bir kez kullanılır.\n\n${codes.join("\n")}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "recall-yedek-kodlar.txt";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-body">
        Telefonunuzu kaybederseniz bu kodlarla giriş yaparsınız. Her kod bir kez kullanılır.{" "}
        <strong className="text-heading">Bu kodları yalnızca şimdi görebilirsiniz.</strong>
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-card border border-hairline bg-canvas p-4 font-mono text-sm text-heading tabular-nums">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <Download data-icon="inline-start" />
          İndir
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <Printer data-icon="inline-start" />
          Yazdır
        </Button>
      </div>
      <div className="flex items-center gap-2.5">
        <Checkbox id="codes-saved" checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
        <Label htmlFor="codes-saved" className="font-normal text-body">
          Kodları güvenli bir yere kaydettim
        </Label>
      </div>
      <Button type="button" disabled={!saved} onClick={onDone}>
        {doneLabel}
      </Button>
    </div>
  );
}

function PasswordStep({
  label,
  action,
  onResult,
}: {
  label: string;
  action: (password: string) => Promise<{ ok: boolean; message?: string }>;
  onResult?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const password = String(new FormData(event.currentTarget).get("password") ?? "");
        startTransition(async () => {
          const result = await action(password);
          if (!result.ok) setError(result.message ?? "Bir sorun oluştu.");
          else onResult?.();
        });
      }}
    >
      <FormField label="Parola" error={error ?? undefined}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </FormField>
      <Button type="submit" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" />}
        {label}
      </Button>
    </form>
  );
}

/**
 * Enrolment: password → recovery codes → QR and code. The codes come first:
 * confirming the code replaces the session and goes on to the panel, and
 * nobody should have two-step sign-in on without saved codes.
 */
export function EnrolmentFlow() {
  const [setup, setSetup] = useState<{ qr: string; secret: string; backupCodes: string[] } | null>(
    null,
  );
  const [codesSaved, setCodesSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!setup) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-body">
          Telefonunuza bir kimlik doğrulama uygulaması kurun (Google Authenticator, Microsoft
          Authenticator veya benzeri). Hesap kişiseldir; ortak hesapla çalışmaz.
        </p>
        <PasswordStep
          label="Devam"
          action={async (password) => {
            const result = await startTwoFactorEnrolment(password);
            if (result.ok) setSetup(result);
            return result;
          }}
        />
      </div>
    );
  }
  if (!codesSaved) {
    return (
      <RecoveryCodes
        codes={setup.backupCodes}
        doneLabel="Devam"
        onDone={() => setCodesSaved(true)}
      />
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-body">Uygulamada yeni hesap ekleyin ve bu kodu tarayın.</p>
      <div
        role="img"
        aria-label="Kimlik doğrulama uygulaması için QR kod"
        className="mx-auto size-48 rounded-card border border-hairline bg-paper p-3 text-heading"
        dangerouslySetInnerHTML={{ __html: setup.qr }}
      />
      <p className="text-center text-xs text-body">
        Tarayamıyorsanız bu anahtarı elle girin:
        <span className="mt-1 block font-mono text-sm break-all text-heading">{setup.secret}</span>
      </p>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const code = String(new FormData(event.currentTarget).get("code") ?? "");
          startTransition(async () => {
            // On success the action goes on to the panel.
            const result = await confirmTwoFactorEnrolment(code);
            if (!result.ok) setError(result.message);
          });
        }}
      >
        <FormField label="Uygulamadaki 6 haneli kod" error={error ?? undefined}>
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
          />
        </FormField>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" />}
          Onayla
        </Button>
      </form>
    </div>
  );
}

/** For people already enrolled: new recovery codes, and turning it off when allowed. */
export function EnrolledActions({ canDisable }: { canDisable: boolean }) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"idle" | "codes" | "disable">("idle");

  if (codes) return <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />;
  return (
    <div className="flex flex-col gap-4">
      {mode === "codes" && (
        <PasswordStep
          label="Yeni yedek kodlar oluştur"
          action={async (password) => {
            const result = await regenerateRecoveryCodes(password);
            if (result.ok) {
              setCodes(result.backupCodes);
              setMode("idle");
            }
            return result;
          }}
        />
      )}
      {mode === "disable" && (
        <PasswordStep label="İki adımlı girişi kapat" action={disableTwoFactor} />
      )}
      {mode === "idle" && (
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" onClick={() => setMode("codes")}>
            Yedek kodları yenile
          </Button>
          {canDisable && (
            <Button type="button" variant="ghost" onClick={() => setMode("disable")}>
              Kapat
            </Button>
          )}
          <Button asChild variant="link">
            <Link href="/panel">Panele dön</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
