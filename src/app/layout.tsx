import type { Metadata } from "next";

// Self-hosted (no network at build time); includes latin-ext for Turkish.
import "@fontsource-variable/montserrat";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Recall: Kliniğiniz için sesli asistan",
    template: "%s · Recall",
  },
  description:
    "Kliniğinizin telefonlarını 7/24 açan, randevu alan ve takviminize işleyen Türkçe yapay zekâ asistanı.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
