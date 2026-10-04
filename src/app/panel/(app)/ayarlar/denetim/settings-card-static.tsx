import type { ReactNode } from "react";

/** Server-rendered variant of SettingsCard for read-only pages. */
export function SettingsCardStatic({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-card border border-hairline bg-paper">
      <div className="flex flex-col gap-1 border-b border-hairline px-6 py-5">
        <h2 className="text-lg font-semibold tracking-tight text-heading">{title}</h2>
        {description && <p className="text-sm text-body">{description}</p>}
      </div>
      <div className="flex flex-col gap-5 px-6 py-5">{children}</div>
    </section>
  );
}
