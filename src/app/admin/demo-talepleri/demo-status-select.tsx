"use client";

import { DEMO_REQUEST_STATUS_LABELS, DEMO_REQUEST_STATUSES } from "@/lib/contracts/platform";

import { useSave } from "../../panel/(app)/ayarlar/_components/settings-ui";
import { setDemoRequestStatusAction } from "../actions";

export function DemoStatusSelect({
  id,
  status,
}: {
  id: string;
  status: (typeof DEMO_REQUEST_STATUSES)[number];
}) {
  const { pending, save } = useSave();
  return (
    <select
      aria-label="Durum"
      defaultValue={status}
      disabled={pending}
      onChange={(event) => save(() => setDemoRequestStatusAction(id, event.target.value))}
      className="h-9 shrink-0 rounded-full border border-hairline bg-paper px-3 text-sm text-heading"
    >
      {DEMO_REQUEST_STATUSES.map((value) => (
        <option key={value} value={value}>
          {DEMO_REQUEST_STATUS_LABELS[value]}
        </option>
      ))}
    </select>
  );
}
