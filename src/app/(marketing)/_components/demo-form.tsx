"use client";

import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { useActionState, useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import {
  CLINIC_TYPES,
  type DemoRequestField,
  type DemoRequestState,
} from "@/lib/contracts/demo-request";

import { submitDemoRequest } from "../actions";

const initialState: DemoRequestState = { status: "idle" };

const inputClass =
  "w-full rounded-card-sm border border-hairline bg-paper px-4 py-3 text-heading placeholder:text-body/60 focus:border-primary focus:outline-none aria-invalid:border-primary";

export function DemoForm() {
  const [state, formAction, pending] = useActionState(submitDemoRequest, initialState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  if (state.status === "success") {
    return (
      <div
        role="status"
        data-header-tone="light"
        className="flex flex-col items-center gap-4 rounded-bento bg-paper p-10 text-center"
      >
        <CheckCircle2 aria-hidden className="size-12 text-success" />
        <h3 className="text-xl font-semibold text-heading">Talebiniz alındı</h3>
        <p className="max-w-sm text-body">
          Ekibimiz en kısa sürede sizinle iletişime geçecek. İlginiz için teşekkür ederiz.
        </p>
      </div>
    );
  }

  return (
    <form
      data-header-tone="light"
      action={formAction}
      noValidate
      className="flex flex-col gap-5 rounded-bento bg-paper p-6 shadow-2xl shadow-ink/30 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ad soyad" name="fullName" error={errors.fullName}>
          {(props) => <input {...props} autoComplete="name" className={inputClass} />}
        </Field>
        <Field label="Klinik adı" name="clinicName" error={errors.clinicName}>
          {(props) => <input {...props} autoComplete="organization" className={inputClass} />}
        </Field>
        <Field label="Telefon" name="phone" error={errors.phone}>
          {(props) => (
            <input
              {...props}
              type="tel"
              autoComplete="tel"
              placeholder="0532 123 45 67"
              className={inputClass}
            />
          )}
        </Field>
        <Field label="E-posta (isteğe bağlı)" name="email" error={errors.email}>
          {(props) => <input {...props} type="email" autoComplete="email" className={inputClass} />}
        </Field>
      </div>

      <Field label="Klinik türü" name="clinicType" error={errors.clinicType}>
        {(props) => (
          <select {...props} defaultValue="" className={inputClass}>
            <option value="" disabled>
              Seçin
            </option>
            {CLINIC_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="Mesajınız (isteğe bağlı)" name="message" error={errors.message}>
        {(props) => (
          <textarea
            {...props}
            rows={3}
            placeholder="Kliniğiniz ve beklentileriniz hakkında kısa bir not"
            className={cn(inputClass, "resize-none")}
          />
        )}
      </Field>

      {/* Honeypot: hidden from people, filled by bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />

      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 text-sm text-body">
          <input
            type="checkbox"
            name="consent"
            aria-invalid={Boolean(errors.consent)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          Paylaştığım bilgilerin demo talebimle ilgili iletişim amacıyla işlenmesini kabul ediyorum.
        </label>
        {errors.consent && <p className="text-sm text-primary">{errors.consent}</p>}
      </div>

      {state.status === "error" && (
        <p role="alert" className="rounded-card-sm bg-primary-soft px-4 py-3 text-sm text-heading">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-3 rounded-full bg-primary px-6 py-4 font-medium text-on-dark transition-colors duration-300 hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        ) : (
          <Send aria-hidden className="size-4" />
        )}
        {pending ? "Gönderiliyor" : "Demo talep edin"}
      </button>
    </form>
  );
}

type FieldControlProps = {
  id: string;
  name: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
};

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: DemoRequestField;
  error?: string;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-heading">
        {label}
      </label>
      {children({
        id,
        name,
        "aria-invalid": Boolean(error),
        "aria-describedby": error ? errorId : undefined,
      })}
      {error && (
        <p id={errorId} className="text-sm text-primary">
          {error}
        </p>
      )}
    </div>
  );
}
