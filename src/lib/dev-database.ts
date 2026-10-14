/**
 * Scripts that write to or copy from a database (exports, rehearsals, voice
 * evaluation) run only against the Neon dev branch or a local database. An
 * allow-list (full audit FA-24): a restored or recreated production endpoint
 * is refused as well. The URL is never echoed: it carries the password.
 */
export const DEV_DATABASE_ENDPOINT = "ep-empty-smoke-b163qx6v";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Null when the URL is the dev branch or local, otherwise why it is refused. */
export function devDatabaseRefusal(url: string | undefined): string | null {
  if (!url) return "DATABASE_URL is missing.";
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return "DATABASE_URL is not a valid URL.";
  }
  if (LOCAL_HOSTS.has(host)) return null;
  if (host.split(".")[0]?.replace(/-pooler$/, "") === DEV_DATABASE_ENDPOINT) return null;
  return "DATABASE_URL is not the Neon dev branch or a local database; refusing to run.";
}
