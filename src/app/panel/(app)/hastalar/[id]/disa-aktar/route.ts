import { z } from "zod";

import { requirePanelScope } from "@/server/auth/session";
import { db } from "@/server/db";
import { recordAudit } from "@/server/domain/audit";
import { exportPatientData } from "@/server/domain/panel";

/** KVKK access request: downloads everything held on the patient as JSON. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/panel/hastalar/[id]/disa-aktar">,
) {
  const { id } = await params;
  const { context, scope } = await requirePanelScope({ patients: ["export"] });
  const data = z.uuid().safeParse(id).success ? await exportPatientData(db(), scope, id) : null;
  if (!data) return Response.json({ error: "Hasta bulunamadı." }, { status: 404 });

  // No download without its trace: a failed audit write refuses the export.
  try {
    await recordAudit(db(), {
      clinicId: context.clinic.id,
      actorUserId: context.session.user.id,
      action: "patient.exported",
      targetType: "patient",
      targetId: id,
    });
  } catch {
    return Response.json(
      { error: "Dışa aktarma şu anda yapılamıyor. Recall ekibi bilgilendirildi." },
      { status: 503 },
    );
  }
  const body = JSON.stringify(
    { klinik: context.clinic.name, disaAktarim: new Date(), ...data },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // The name carries no personal data; the file itself does, so no caching.
      "content-disposition": `attachment; filename="hasta-verileri-${id.slice(0, 8)}.json"`,
      "cache-control": "no-store",
    },
  });
}
