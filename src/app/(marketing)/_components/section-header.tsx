import { cn } from "@/lib/cn";

import { DisplayHeading, Eyebrow } from "@/components/design";

/** Eyebrow + heading + lead paragraph shared by every landing section. */
export function SectionHeader({
  eyebrow,
  title,
  lead,
  tone = "light",
  align = "left",
  className,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  tone?: "light" | "dark";
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex max-w-3xl flex-col gap-4",
        align === "center" && "mx-auto items-center text-center",
        className,
      )}
    >
      <Eyebrow className={tone === "dark" ? "text-accent" : "text-primary"}>{eyebrow}</Eyebrow>
      <DisplayHeading className={tone === "dark" ? "text-on-dark" : "text-heading"}>
        {title}
      </DisplayHeading>
      {lead && (
        <p
          className={cn(
            "text-lg leading-relaxed",
            tone === "dark" ? "text-on-dark-muted" : "text-body",
          )}
        >
          {lead}
        </p>
      )}
    </div>
  );
}
