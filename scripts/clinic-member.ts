/**
 * Adds a person to a clinic's team (Recall team only; the panel uses
 * invitations). New users receive a "set your password" email; with
 * EMAIL_PROVIDER=console the link is printed here.
 *
 *   pnpm clinic:member --clinic <slug> --email <email> --name "<ad soyad>" [--role owner|admin|staff|practitioner]
 *
 * Runs with the `react-server` condition so server-only modules can load.
 */
import { config } from "dotenv";

import { isBuiltInRole } from "@/lib/permissions";
import { addClinicMember } from "@/server/auth/accounts";
import { maskEmail } from "@/server/notifications/email";
import { db } from "@/server/db";
import { findClinicBySlug } from "@/server/domain/clinics";

config({ path: [".env.local", ".env"], quiet: true });

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : undefined;
}

async function main() {
  const slug = argValue("--clinic");
  const email = argValue("--email");
  const name = argValue("--name");
  const role = argValue("--role") ?? "owner";
  if (!slug || !email || !name || !isBuiltInRole(role)) {
    console.error(
      'Usage: pnpm clinic:member --clinic <slug> --email <email> --name "<ad soyad>" [--role owner|admin|staff|practitioner]',
    );
    process.exit(2);
  }

  const context = await findClinicBySlug(db(), slug);
  if (!context) {
    console.error(`No clinic found with slug "${slug}".`);
    process.exit(1);
  }

  const result = await addClinicMember({ clinicId: context.clinic.id, email, name, role });
  console.info(
    `✓ ${slug}: ${maskEmail(email)} · role=${role} · user ${result.userCreated ? "created" : "existing"} · member ${result.memberCreated ? "added" : "already present"}${result.passwordEmailSent ? " · password email sent" : ""}`,
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
