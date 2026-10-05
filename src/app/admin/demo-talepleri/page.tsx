import { Inbox, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { EmptyState, PageHeader } from "@/components/panel";
import { DEMO_REQUEST_STATUSES } from "@/lib/contracts/platform";
import { formatPhone } from "@/lib/phone";
import { requirePlatformAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { listDemoRequests } from "@/server/platform/demo-requests";

import { DemoStatusSelect } from "./demo-status-select";

export const metadata: Metadata = { title: "Demo talepleri" };

const when = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

export default async function DemoRequestsPage() {
  await connection();
  await requirePlatformAdmin();
  const requests = await listDemoRequests(db());
  const open = requests.filter((r) => r.status === "new").length;

  return (
    <>
      <PageHeader
        title="Demo talepleri"
        description={`Tanıtım sayfasındaki formdan · ${open} yeni talep`}
      />
      {requests.length === 0 ? (
        <EmptyState icon={Inbox} title="Henüz demo talebi yok" />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-col gap-3 rounded-card border border-hairline bg-paper p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="font-semibold text-heading">{request.clinicName}</span>
                  <span className="text-sm text-body">
                    {request.fullName} · {request.clinicType}
                  </span>
                  <span className="text-xs text-body">{when.format(request.createdAt)}</span>
                </div>
                <DemoStatusSelect
                  id={request.id}
                  status={DEMO_REQUEST_STATUSES.find((s) => s === request.status) ?? "new"}
                />
              </div>
              {request.message && <p className="text-sm text-heading">{request.message}</p>}
              <div className="flex flex-wrap gap-2 border-t border-hairline pt-3 text-sm">
                <a
                  href={`tel:${request.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 font-medium text-primary tabular-nums"
                >
                  <Phone aria-hidden className="size-3.5" />
                  {formatPhone(request.phone)}
                </a>
                {request.email && (
                  <a
                    href={`mailto:${request.email}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-heading"
                  >
                    <Mail aria-hidden className="size-3.5" />
                    {request.email}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
