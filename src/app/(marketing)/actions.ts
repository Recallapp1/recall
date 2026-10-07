"use server";

import {
  demoRequestSchema,
  type DemoRequestField,
  type DemoRequestState,
} from "@/lib/contracts/demo-request";
import { safeError } from "@/lib/safe-error";
import { db } from "@/server/db";
import { createDemoRequest } from "@/server/domain/demo-requests";
import { allow, requestIp } from "@/server/security/rate-limits";

/** Landing page demo request. Bots fill the hidden `website` field and are ignored. */
export async function submitDemoRequest(
  _previous: DemoRequestState,
  formData: FormData,
): Promise<DemoRequestState> {
  if (formData.get("website")) return { status: "success" };

  const parsed = demoRequestSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    clinicName: formData.get("clinicName") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    clinicType: formData.get("clinicType") ?? "",
    message: formData.get("message") ?? "",
    consent: formData.get("consent") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Partial<Record<DemoRequestField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as DemoRequestField;
      fieldErrors[field] ??= issue.message;
    }
    return { status: "error", message: "Lütfen işaretli alanları kontrol edin.", fieldErrors };
  }

  if (!(await allow("demoRequestIp", [await requestIp()]))) {
    return {
      status: "error",
      message: "Kısa sürede çok fazla talep gönderildi. Lütfen daha sonra tekrar deneyin.",
    };
  }

  try {
    await createDemoRequest(db(), parsed.data, new Date());
    return { status: "success" };
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "demo_request.failed",
        error: safeError(error),
      }),
    );
    return {
      status: "error",
      message: "Talebiniz şu anda alınamadı. Lütfen biraz sonra tekrar deneyin.",
    };
  }
}
