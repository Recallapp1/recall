import "server-only";

import { eq } from "drizzle-orm";

import { safeError } from "@/lib/safe-error";

import { db } from "../db";
import { clinics } from "../db/schema";
import { recordAudit } from "../domain/audit";
import { auth } from ".";

/** Endpoint names are fixed strings; anything else is cut so logs stay small. */
const MAX_PATH_LENGTH = 80;

/**
 * Answers a closed Better Auth endpoint with 404 and leaves a trace: a log
 * line always, and an audit event in the caller's clinic when the request
 * carries a session (a signed-in user probing the API is worth knowing about).
 */
export async function recordBlockedAuthRequest(request: Request, path: string): Promise<Response> {
  const endpoint = path.slice(0, MAX_PATH_LENGTH);
  console.warn(JSON.stringify({ msg: "auth.endpoint_blocked", method: request.method, endpoint }));
  try {
    const session = await auth().api.getSession({ headers: request.headers });
    if (session) {
      const organizationId = session.session.activeOrganizationId;
      const [clinic] = organizationId
        ? await db()
            .select({ id: clinics.id })
            .from(clinics)
            .where(eq(clinics.organizationId, organizationId))
        : [];
      await recordAudit(db(), {
        clinicId: clinic?.id ?? null,
        actorUserId: session.user.id,
        action: "security.auth_endpoint_blocked",
        metadata: { method: request.method, endpoint },
      });
    }
  } catch (error) {
    console.error(
      JSON.stringify({ msg: "auth.endpoint_blocked_audit_failed", error: safeError(error) }),
    );
  }
  return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
}
