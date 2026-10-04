"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";

/** Practitioner filter for the calendar; the selection lives in the URL. */
export function PractitionerFilter({
  value,
  options,
  hrefs,
}: {
  value: string;
  options: { id: string; name: string }[];
  /** Target URL per practitioner id ("" = all practitioners). */
  hrefs: Record<string, string>;
}) {
  const router = useRouter();
  const label = options.find((option) => option.id === value)?.name ?? "Tüm hekimler";
  return (
    <Select
      value={value || ALL}
      onValueChange={(next) => router.push(hrefs[next === ALL ? "" : next] ?? "/panel/takvim")}
    >
      <SelectTrigger size="sm" aria-label="Hekim" className="h-10 min-w-44 rounded-full">
        {/* Explicit text: Radix shows the selection only after the list has rendered. */}
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Tüm hekimler</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
