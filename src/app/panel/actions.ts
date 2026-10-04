"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { listMemberships } from "@/server/auth/accounts";
import { requireSession } from "@/server/auth/session";

/** Clinic switcher. Membership is checked here and again by Better Auth. */
export async function switchClinic(organizationId: string) {
  const session = await requireSession();
  const memberships = await listMemberships(session.user.id);
  if (!memberships.some((m) => m.organizationId === organizationId)) redirect("/panel/klinik-sec");

  await auth().api.setActiveOrganization({ body: { organizationId }, headers: await headers() });
  redirect("/panel");
}
