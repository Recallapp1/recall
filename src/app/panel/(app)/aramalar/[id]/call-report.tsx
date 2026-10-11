"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CALL_REPORT_LABELS,
  CALL_REPORT_REASONS,
  type CallReportReason,
} from "@/lib/contracts/call";

import { reportCall } from "../actions";

/** "Asistan hatası bildir" (CALL_REVIEW, R2 5d). */
export function CallReportForm({
  callId,
  reports,
}: {
  callId: string;
  reports: { reason: CallReportReason; createdAt: string }[];
}) {
  const [reason, setReason] = useState<CallReportReason | "">("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="flex flex-col gap-3 rounded-card border border-hairline bg-paper p-6">
      <h2 className="text-label text-body">Asistan hatası bildir</h2>
      <p className="text-sm text-body">
        Asistan bu görüşmede yanlış davrandıysa sebebini seçin. Recall ekibi inceler.
      </p>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (!reason) return;
          startTransition(async () => {
            const result = await reportCall({ callId, reason });
            if (result.ok) {
              toast.success(result.message);
              setReason("");
            } else toast.error(result.message);
          });
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span id="call-report-reason" className="text-sm font-medium text-heading">
            Sebep
          </span>
          <Select value={reason} onValueChange={(value) => setReason(value as CallReportReason)}>
            <SelectTrigger aria-labelledby="call-report-reason" className="w-full">
              <SelectValue placeholder="Sebep seçin">
                {reason ? CALL_REPORT_LABELS[reason] : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CALL_REPORT_REASONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {CALL_REPORT_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="secondary" disabled={!reason || pending}>
          {pending && <LoaderCircle className="animate-spin" />}
          Bildir
        </Button>
      </form>
      {reports.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-body">
          {reports.map((report) => (
            <li key={`${report.reason}-${report.createdAt}`}>
              {CALL_REPORT_LABELS[report.reason]} ·{" "}
              {new Date(report.createdAt).toLocaleString("tr-TR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
