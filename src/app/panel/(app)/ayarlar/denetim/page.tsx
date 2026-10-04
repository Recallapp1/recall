import type { Metadata } from "next";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listAuditEvents, type AuditAction } from "@/server/domain/audit";
import { listTeam } from "@/server/auth/team";

import { SettingsCardStatic } from "./settings-card-static";

export const metadata: Metadata = { title: "Denetim kaydı" };

const ACTION_LABELS: Record<AuditAction, string> = {
  "auth.sign_in": "Giriş yaptı",
  "team.invitation_created": "Davet gönderdi",
  "team.invitation_cancelled": "Daveti iptal etti",
  "team.invitation_accepted": "Daveti kabul etti",
  "team.member_added": "Ekibe eklendi",
  "team.member_role_changed": "Rol değiştirdi",
  "team.member_removed": "Ekipten çıkardı",
  "team.role_saved": "Özel rol kaydetti",
  "team.role_deleted": "Özel rol sildi",
  "settings.updated": "Ayar değiştirdi",
  "patient.updated": "Hasta notunu güncelledi",
  "patient.anonymized": "Hastayı anonimleştirdi",
  "call.recording_played": "Arama kaydını dinledi",
  "appointment.created": "Randevu oluşturdu",
  "appointment.updated": "Randevuyu güncelledi",
  "appointment.status_changed": "Randevu durumunu değiştirdi",
};

const TARGET_LABELS: Record<string, string> = {
  clinic: "Klinik bilgileri",
  clinic_hours: "Çalışma saatleri",
  practitioner: "Hekim",
  service: "Hizmet",
  assistant: "Asistan",
  booking: "Randevu kuralları",
  appointment: "Randevu",
  patient: "Hasta",
  call: "Arama",
  member: "Ekip üyesi",
  invitation: "Davet",
  user: "Kullanıcı",
};

export default async function AuditPage() {
  const { clinic } = await requirePermission({ audit: ["read"] });
  const [events, team] = await Promise.all([
    listAuditEvents(db(), clinic.id, 200),
    listTeam(db(), clinic.organizationId!),
  ]);
  const names = new Map(team.map((m) => [m.userId, m.name]));
  const when = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: clinic.timezone,
  });

  return (
    <SettingsCardStatic
      title="Denetim kaydı"
      description="Panelde kimin ne yaptığının son 200 kaydı. Kişisel veri içermez."
    >
      {events.length === 0 ? (
        <p className="text-sm text-body">Henüz kayıt yok.</p>
      ) : (
        <Table className="min-w-[36rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Zaman</TableHead>
              <TableHead>Kişi</TableHead>
              <TableHead>İşlem</TableHead>
              <TableHead>Konu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="tabular-nums">{when.format(event.createdAt)}</TableCell>
                <TableCell>
                  {event.actorUserId
                    ? (names.get(event.actorUserId) ?? "Eski ekip üyesi")
                    : "Recall ekibi"}
                </TableCell>
                <TableCell>{ACTION_LABELS[event.action as AuditAction] ?? event.action}</TableCell>
                <TableCell className="text-body">
                  {event.targetType ? (TARGET_LABELS[event.targetType] ?? event.targetType) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SettingsCardStatic>
  );
}
