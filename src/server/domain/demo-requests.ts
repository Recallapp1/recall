import "server-only";

import type { DemoRequestInput } from "@/lib/contracts/demo-request";
import { normalizePhone } from "@/lib/phone";

import type { Executor } from "../db";
import { demoRequests } from "../db/schema";

export async function createDemoRequest(exec: Executor, input: DemoRequestInput, now: Date) {
  const [row] = await exec
    .insert(demoRequests)
    .values({
      fullName: input.fullName,
      clinicName: input.clinicName,
      phone: normalizePhone(input.phone) ?? input.phone,
      email: input.email ?? null,
      clinicType: input.clinicType,
      message: input.message ?? null,
      consentAt: now,
    })
    .returning({ id: demoRequests.id });
  return row;
}
