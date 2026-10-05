import "server-only";

import { desc, eq } from "drizzle-orm";

import type { DEMO_REQUEST_STATUSES } from "@/lib/contracts/platform";

import type { Executor } from "../db";
import { demoRequests } from "../db/schema";
import { DomainError } from "../domain/errors";

export async function listDemoRequests(exec: Executor, limit = 200) {
  return exec.select().from(demoRequests).orderBy(desc(demoRequests.createdAt)).limit(limit);
}

export async function setDemoRequestStatus(
  exec: Executor,
  input: { id: string; status: (typeof DEMO_REQUEST_STATUSES)[number]; now: Date },
): Promise<void> {
  const updated = await exec
    .update(demoRequests)
    .set({ status: input.status, handledAt: input.status === "new" ? null : input.now })
    .where(eq(demoRequests.id, input.id))
    .returning({ id: demoRequests.id });
  if (updated.length === 0) throw new DomainError("NOT_FOUND", "Talep bulunamadı.");
}
