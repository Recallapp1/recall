"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { safeError } from "@/lib/safe-error";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { DomainError } from "@/server/domain/errors";
import { setCallbackStatus } from "@/server/domain/panel";

const input = z.object({ callbackId: z.uuid(), status: z.enum(["open", "done"]) });

export async function updateCallback(value: {
  callbackId: string;
  status: "open" | "done";
}): Promise<{ ok: boolean; message: string }> {
  const { clinic } = await requirePermission({ callbacks: ["update"] });
  const parsed = input.safeParse(value);
  if (!parsed.success) return { ok: false, message: "İşlem yapılamadı." };

  try {
    await setCallbackStatus(db(), clinic.id, { ...parsed.data, now: new Date() });
    revalidatePath("/panel", "layout");
    return {
      ok: true,
      message: parsed.data.status === "done" ? "Geri arama tamamlandı." : "Talep yeniden açıldı.",
    };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.userMessage };
    console.error(JSON.stringify({ msg: "panel.callback_update.failed", error: safeError(error) }));
    return { ok: false, message: "İşlem şu anda yapılamadı. Lütfen tekrar deneyin." };
  }
}
