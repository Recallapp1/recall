import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * EMAIL_PROVIDER=console in production (full audit FA-30): the console
 * provider prints one-time links (passwords, invitations); in production it
 * must refuse and alarm instead of writing them to the logs.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

function stubBase() {
  vi.stubEnv("APP_URL", "https://recall.invalid");
  vi.stubEnv("DATABASE_URL", "postgres://unused@localhost/unused");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-123");
  vi.stubEnv("EMAIL_PROVIDER", "console");
}

const message = {
  to: "kisi@klinik.test",
  subject: "Parolanızı belirleyin",
  html: "<p>link</p>",
  text: "https://recall.invalid/sifre-belirle?token=gizli-baglanti-123",
};

describe("console e-mail provider", () => {
  it("in production: refuses, alarms, and never prints the link", async () => {
    stubBase();
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { emailProvider } = await import("./email");
    await expect(emailProvider().send(message)).rejects.toThrow();
    const printed = [...info.mock.calls, ...error.mock.calls].flat().map(String).join("\n");
    expect(printed).not.toContain("gizli-baglanti-123");
    expect(printed).toContain("email.console_in_production");
  });

  it("outside production: prints the link for local development, as before", async () => {
    stubBase();
    vi.stubEnv("NODE_ENV", "development");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { emailProvider } = await import("./email");
    await emailProvider().send(message);
    expect(info.mock.calls.flat().map(String).join("\n")).toContain("gizli-baglanti-123");
  });
});
