import type { Metadata } from "next";

// Self-hosted (no network at build time); includes latin-ext for Turkish.
import "@fontsource-variable/montserrat";

import { env } from "@/lib/env";

import "./globals.css";

const TITLE = "Recall: Kliniğiniz için sesli asistan";
const DESCRIPTION =
  "Kliniğinizin telefonlarını 7/24 açan, randevu alan ve takviminize işleyen Türkçe yapay zekâ asistanı.";

export function generateMetadata(): Metadata {
  return {
    // Absolute URLs for canonical, Open Graph and sitemap links.
    metadataBase: new URL(env().APP_URL),
    title: { default: TITLE, template: "%s · Recall" },
    description: DESCRIPTION,
    applicationName: "Recall",
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "tr_TR",
      siteName: "Recall",
      title: TITLE,
      description: DESCRIPTION,
      url: "/",
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
