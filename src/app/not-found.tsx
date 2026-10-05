import type { Metadata } from "next";

import { ActionLink, BodyText, DisplayHeading, Eyebrow, SecondaryLink } from "@/components/design";
import { Logo } from "@/components/design/logo";

export const metadata: Metadata = { title: "Sayfa bulunamadı" };

/** Site-wide 404: public links, panel and console all land here. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh p-4 sm:p-6">
      <section
        data-header-tone="dark"
        className="surface-dark flex flex-1 flex-col items-center justify-center gap-6 rounded-section px-6 py-16 text-center"
      >
        <Logo />
        <Eyebrow className="text-accent">404</Eyebrow>
        <DisplayHeading as="h1">Bu sayfayı bulamadık</DisplayHeading>
        <BodyText className="max-w-md text-on-dark-muted">
          Adres değişmiş ya da yanlış yazılmış olabilir. Ana sayfaya dönebilir veya panelinize giriş
          yapabilirsiniz.
        </BodyText>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionLink href="/">Ana sayfa</ActionLink>
          <SecondaryLink href="/panel">Panele giriş</SecondaryLink>
        </div>
      </section>
    </main>
  );
}
