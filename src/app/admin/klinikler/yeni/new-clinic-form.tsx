"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";

import { FormField } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { fieldClassName, Input } from "@/components/ui/input";
import { CLINIC_TEMPLATE_KEYS, CLINIC_TEMPLATES, slugify } from "@/lib/clinic-templates";
import { cn } from "@/lib/cn";
import type { FormState } from "@/lib/contracts/form-state";
import type { CreateClinicField } from "@/lib/contracts/platform";

import { createClinicAction } from "../../actions";

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-card border border-hairline bg-paper p-6">
      <h2 className="flex items-center gap-3 text-lg font-semibold tracking-tight text-heading">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-sm text-primary">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function NewClinicForm() {
  const [state, action, pending] = useActionState<FormState<CreateClinicField>, FormData>(
    createClinicAction,
    { status: "idle" },
  );
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <form action={action} noValidate className="flex max-w-3xl flex-col gap-6">
      {state.status === "error" && (
        <p role="alert" className="rounded-card-sm bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.message}
        </p>
      )}

      <Section step={1} title="Klinik">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Klinik adı" error={errors.name}>
            <Input
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slugEdited) setSlug(slugify(event.target.value));
              }}
              required
            />
          </FormField>
          <FormField
            label="Kısa ad"
            error={errors.slug}
            hint="Sistemde kliniği tanımlar; sonradan değişmez."
          >
            <Input
              name="slug"
              value={slug}
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugEdited(true);
              }}
              required
            />
          </FormField>
          <FormField label="Sektör şablonu" error={errors.template} className="sm:col-span-2">
            {(field) => (
              <select
                {...field}
                name="template"
                defaultValue="dis"
                className={cn(fieldClassName, "h-11")}
              >
                {CLINIC_TEMPLATE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {CLINIC_TEMPLATES[key].label} · {CLINIC_TEMPLATES[key].services.length} hizmet
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>
      </Section>

      <Section step={2} title="Klinik sahibi">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Ad soyad" error={errors.ownerName}>
            <Input name="ownerName" autoComplete="off" required />
          </FormField>
          <FormField
            label="E-posta"
            error={errors.ownerEmail}
            hint="Parola belirleme bağlantısı bu adrese gider."
          >
            <Input name="ownerEmail" type="email" autoComplete="off" required />
          </FormField>
        </div>
      </Section>

      <Section step={3} title="Telefon numarası (isteğe bağlı)">
        <FormField
          label="Asistanın karşılayacağı numara"
          error={errors.phoneNumber}
          hint="Numaranın ses platformunda içe aktarılıp gelen arama webhook'una bağlanması gerekir. Sonradan da eklenebilir."
        >
          <Input name="phoneNumber" type="tel" placeholder="0850 123 45 67" />
        </FormField>
      </Section>

      <Button type="submit" size="lg" disabled={pending} className="w-fit">
        {pending && <LoaderCircle className="animate-spin" />}
        Kliniği oluştur
      </Button>
    </form>
  );
}
