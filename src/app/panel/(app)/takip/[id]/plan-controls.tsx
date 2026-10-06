"use client";

import { CalendarPlus, Link2, Pause, Play, Square, Unlink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FormField } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  FOLLOW_UP_STOP_REASONS,
  STOP_REASON_LABELS,
  type FollowUpStopReason,
  type PlanAction,
} from "@/lib/contracts/follow-up";
import { formatShortDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

import { SaveButton, SettingsCard, useSave } from "../../ayarlar/_components/settings-ui";
import { setAppointmentStatus } from "../../randevular/actions";
import { NewAppointmentDialog, type BookingOptions } from "../../randevular/new-appointment-dialog";
import { followUpAction } from "../actions";

type VisitStatus =
  | { kind: "counted"; date: string; auto: boolean }
  | { kind: "booked"; date: string }
  | { kind: "not_counted"; date: string; reason: "cancelled" | "no_show" };

const SOURCE_LABELS: Record<string, string> = {
  start: "Başlangıç ziyareti",
  auto_link: "Otomatik bağlandı",
  staff_link: "Personel bağladı",
  manual: "Randevusuz ziyaret",
};

export function VisitRow({
  planId,
  visit,
  canManage,
  canCorrect,
}: {
  planId: string;
  visit: { appointmentId: string | null; source: string; status: VisitStatus };
  canManage: boolean;
  canCorrect: boolean;
}) {
  const { pending, save } = useSave();
  const { status } = visit;
  const label =
    status.kind === "counted"
      ? "Sayıldı"
      : status.kind === "booked"
        ? "Randevulu"
        : status.reason === "no_show"
          ? "Sayılmadı · Gelmedi"
          : "Sayılmadı · İptal";

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <span className="flex flex-col">
        <span className="text-sm font-medium text-heading tabular-nums">
          {formatShortDate(status.date)}
        </span>
        <span className="text-xs text-body">{SOURCE_LABELS[visit.source] ?? visit.source}</span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            status.kind === "counted" ? "success" : status.kind === "booked" ? "soft" : "secondary"
          }
        >
          {label}
        </Badge>
        {status.kind === "counted" && status.auto && (
          // Decision 1: a passed appointment counts unless staff say otherwise.
          <Badge variant="dashed" title="Randevu saati geçti ve işaretlenmedi">
            otomatik sayıldı
          </Badge>
        )}
        {status.kind === "counted" && status.auto && canCorrect && visit.appointmentId && (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                save(() =>
                  setAppointmentStatus({ appointmentId: visit.appointmentId!, status: "no_show" }),
                )
              }
            >
              Gelmedi
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                save(() =>
                  setAppointmentStatus({
                    appointmentId: visit.appointmentId!,
                    status: "completed",
                  }),
                )
              }
            >
              Geldi
            </Button>
          </>
        )}
        {visit.appointmentId && (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/panel/randevular/${visit.appointmentId}`}>Randevu</Link>
          </Button>
        )}
        {canManage && visit.appointmentId && visit.source !== "start" && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Takipten ayır"
            disabled={pending}
            onClick={() =>
              save(() =>
                followUpAction({ type: "unlink", planId, appointmentId: visit.appointmentId }),
              )
            }
          >
            <Unlink />
          </Button>
        )}
      </span>
    </li>
  );
}

export function PlanControls({
  plan,
  patient,
  booking,
  linkable,
}: {
  plan: {
    id: string;
    state: "active" | "paused" | "stopped" | "completed";
    hasOverride: boolean;
    smsConsent: boolean;
    visitServiceId: string;
  };
  patient: { fullName: string; phone: string };
  booking: BookingOptions | null;
  linkable: { id: string; label: string }[];
}) {
  const { pending, save } = useSave();
  const [dueOn, setDueOn] = useState("");
  const [visitedOn, setVisitedOn] = useState("");
  const [linkId, setLinkId] = useState("");
  const [stopping, setStopping] = useState(false);
  const [reason, setReason] = useState<FollowUpStopReason>("patient_request");
  const open = plan.state === "active" || plan.state === "paused";
  const run = (action: PlanAction, done?: () => void) => save(() => followUpAction(action), done);

  return (
    <>
      {booking && plan.state === "active" && (
        <NewAppointmentDialog
          options={booking}
          prefill={{
            serviceId: plan.visitServiceId,
            patientName: patient.fullName,
            patientPhone: formatPhone(patient.phone),
          }}
          trigger={
            <Button>
              <CalendarPlus data-icon="inline-start" />
              Takip randevusu oluştur
            </Button>
          }
        />
      )}

      <SettingsCard title="Takip">
        <div className="flex items-center gap-3">
          <Switch
            id="smsConsent"
            checked={plan.smsConsent}
            disabled={pending || !open}
            onCheckedChange={(granted) => run({ type: "consent", planId: plan.id, granted })}
          />
          <label htmlFor="smsConsent" className="text-sm text-heading">
            Hasta SMS hatırlatmasını kabul etti
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.state === "active" && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run({ type: "pause", planId: plan.id })}
            >
              <Pause data-icon="inline-start" />
              Duraklat
            </Button>
          )}
          {plan.state === "paused" && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run({ type: "resume", planId: plan.id })}
            >
              <Play data-icon="inline-start" />
              Sürdür
            </Button>
          )}
          {open && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setStopping(true)}
            >
              <Square data-icon="inline-start" />
              Bırak
            </Button>
          )}
        </div>
      </SettingsCard>

      {open && (
        <SettingsCard title="Sonraki tarih">
          <FormField
            label="Tarihi elle belirle"
            hint="Sonraki ziyaret gerçekleşince yeniden hesaplanır."
          >
            <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <SaveButton
              pending={pending}
              disabled={!dueOn}
              onClick={() => run({ type: "set_due", planId: plan.id, dueOn }, () => setDueOn(""))}
            >
              Tarihi kaydet
            </SaveButton>
            {plan.hasOverride && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => run({ type: "clear_due", planId: plan.id })}
              >
                Kurala göre hesapla
              </Button>
            )}
          </div>
        </SettingsCard>
      )}

      {plan.state !== "stopped" && (
        <SettingsCard title="Ziyaret ekle">
          <FormField label="Randevusuz ziyaret" hint="Takvime girmeden yapılan ziyareti sayar.">
            <Input type="date" value={visitedOn} onChange={(e) => setVisitedOn(e.target.value)} />
          </FormField>
          <SaveButton
            pending={pending}
            disabled={!visitedOn}
            onClick={() =>
              run({ type: "record_visit", planId: plan.id, visitedOn }, () => setVisitedOn(""))
            }
          >
            Ziyareti kaydet
          </SaveButton>
          {linkable.length > 0 && (
            <>
              <FormField label="Mevcut randevuyu bağla">
                {(field) => (
                  <Select value={linkId} onValueChange={setLinkId}>
                    <SelectTrigger {...field} className="w-full">
                      <SelectValue placeholder="Randevu seçin">
                        {linkable.find((a) => a.id === linkId)?.label}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {linkable.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              <SaveButton
                pending={pending}
                disabled={!linkId}
                onClick={() =>
                  run({ type: "link", planId: plan.id, appointmentId: linkId }, () => setLinkId(""))
                }
              >
                <Link2 />
                Bağla
              </SaveButton>
            </>
          )}
        </SettingsCard>
      )}

      <Dialog open={stopping} onOpenChange={setStopping}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Takip bırakılsın mı?</DialogTitle>
            <DialogDescription>
              Hatırlatmalar durur. Gerekirse daha sonra yeni bir takip başlatabilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Sebep">
            {(field) => (
              <Select value={reason} onValueChange={(v) => setReason(v as FollowUpStopReason)}>
                <SelectTrigger {...field} className="w-full">
                  <SelectValue>{STOP_REASON_LABELS[reason]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FOLLOW_UP_STOP_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {STOP_REASON_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Vazgeç</Button>
            </DialogClose>
            <SaveButton
              pending={pending}
              onClick={() =>
                run({ type: "stop", planId: plan.id, reason }, () => setStopping(false))
              }
            >
              Takibi bırak
            </SaveButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
