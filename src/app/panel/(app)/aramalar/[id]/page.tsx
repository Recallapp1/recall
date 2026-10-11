import { ArrowLeft, Phone, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AppointmentStatusBadge,
  CallFlagBadges,
  OutcomeBadge,
  PageHeader,
} from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/contracts/call";
import { formatMinutes, formatShortDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { can, requirePanelScope } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { getCall, isTestCall, listCallReports } from "@/server/domain/panel";

import { RecordingPlayer } from "../recording-player";
import { CallReportForm } from "./call-report";
import { TestCallToggle } from "./test-call-toggle";

export const metadata: Metadata = { title: "Arama" };

export default async function CallPage({ params }: PageProps<"/panel/aramalar/[id]">) {
  const { id } = await params;
  const { context, scope } = await requirePanelScope({ calls: ["read"] });
  const call = /^[0-9a-f-]{36}$/i.test(id) ? await getCall(db(), scope, id) : null;
  if (!call) notFound();
  const testFlagOn = env().TEST_CALL_FLAG === true;
  const [canListen, canSeePatients, canMarkTest] = await Promise.all([
    can({ calls: ["listen_recording"] }),
    can({ patients: ["read"] }),
    testFlagOn ? can({ assistantSettings: ["update"] }) : false,
  ]);
  const isTest = testFlagOn ? await isTestCall(db(), context.clinic.id, call.id) : false;
  const reviewOn = env().CALL_REVIEW === true;
  const reports = reviewOn ? await listCallReports(db(), context.clinic.id, call.id) : [];
  const when = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: context.clinic.timezone,
  }).format(call.startedAt ?? call.createdAt);

  return (
    <>
      <Link
        href="/panel/aramalar"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Aramalar
      </Link>
      <PageHeader
        title={call.patientName ?? "Kayıtlı olmayan arayan"}
        description={`${when} · ${formatDuration(call.durationSeconds)}`}
        actions={
          <span className="inline-flex flex-wrap gap-1">
            <OutcomeBadge outcome={call.outcome} />
            <CallFlagBadges flags={call.flags} />
            {isTest && <Badge variant="secondary">Test araması</Badge>}
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-card border border-hairline bg-paper p-6">
            <h2 className="text-label text-body">Özet</h2>
            <p className="text-heading">{call.summary ?? "Bu arama için özet yok."}</p>
          </section>

          {(call.hasRecording || call.transcript) && (
            <section className="flex flex-col gap-4 rounded-card border border-hairline bg-paper p-6">
              <h2 className="text-label text-body">Kayıt ve döküm</h2>
              {call.hasRecording &&
                (canListen ? (
                  <RecordingPlayer callId={call.id} />
                ) : (
                  <p className="text-sm text-body">Kaydı dinleme yetkiniz yok.</p>
                ))}
              {call.transcript && (
                <details className="group rounded-card-sm bg-canvas p-4">
                  <summary className="cursor-pointer text-sm font-medium text-heading">
                    Konuşma dökümü
                  </summary>
                  <p className="mt-3 text-sm whitespace-pre-line text-body">{call.transcript}</p>
                </details>
              )}
            </section>
          )}

          {reviewOn && (
            <CallReportForm
              callId={call.id}
              reports={reports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
            />
          )}
          {call.appointments.length > 0 && (
            <section className="flex flex-col gap-3 rounded-card border border-hairline bg-paper p-6">
              <h2 className="text-label text-body">Bu aramada oluşan randevular</h2>
              <ul className="flex flex-col divide-y divide-hairline">
                {call.appointments.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/panel/randevular/${a.id}`}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-card-sm px-2 py-3 hover:bg-canvas"
                    >
                      <span className="flex flex-col">
                        <span className="text-sm font-medium text-heading">
                          {formatShortDate(a.date)} · {formatMinutes(a.startMinute)}
                        </span>
                        <span className="text-xs text-body">
                          {a.serviceName} · {a.practitionerName}
                        </span>
                      </span>
                      <AppointmentStatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="flex h-fit flex-col gap-4 rounded-card border border-hairline bg-paper p-6">
          <h2 className="text-label text-body">Arayan</h2>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft">
              <UserRound aria-hidden className="size-4 text-primary" />
            </span>
            <span className="flex flex-col">
              <span className="font-medium text-heading">
                {call.patientName ?? "Kayıtlı olmayan arayan"}
              </span>
              <span className="text-sm text-body tabular-nums">{formatPhone(call.fromNumber)}</span>
            </span>
          </div>
          {call.fromNumber && (
            <a
              href={`tel:${call.fromNumber}`}
              className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-dark hover:bg-primary-hover"
            >
              <Phone aria-hidden className="size-4" />
              Geri ara
            </a>
          )}
          {canMarkTest && <TestCallToggle callId={call.id} isTest={isTest} />}
          {call.patientId && canSeePatients && (
            <Link
              href={`/panel/hastalar/${call.patientId}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Hasta kartını aç
            </Link>
          )}
        </aside>
      </div>
    </>
  );
}
