/**
 * Grants the Recall console (platform admin) role. New users receive a
 * "set your password" email; with EMAIL_PROVIDER=console the link is printed.
 *
 *   pnpm platform:admin --email <email> --name "<ad soyad>"
 *
 * Runs with the `react-server` condition so server-only modules can load.
 */
import { config } from "dotenv";

import { maskEmail } from "@/server/notifications/email";
import { ensurePlatformAdmin } from "@/server/platform/admins";

config({ path: [".env.local", ".env"], quiet: true });

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : undefined;
}

async function main() {
  const email = argValue("--email");
  const name = argValue("--name");
  if (!email || !name) {
    console.error('Usage: pnpm platform:admin --email <email> --name "<ad soyad>"');
    process.exit(2);
  }
  const result = await ensurePlatformAdmin({ email, name });
  console.info(
    `✓ ${maskEmail(email)} is a platform admin · user ${result.userCreated ? "created" : "existing"}${result.passwordEmailSent ? " · password email sent" : ""}`,
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
