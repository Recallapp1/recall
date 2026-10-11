import { sign } from "retell-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "../../db";
import type { Clinic } from "../../db/schema";
import { parseClinicSettings } from "../../domain/clinic-settings";
import { handleFunctionCall } from "../providers/retell/handlers";
import { runTool } from ".";
import type { ToolContext } from "./define";

/*
 * R2 4k and 4l: when the database fails inside a tool or before it, the
 * assistant gets an honest ok: false (never a success), and the log lines
 * carry no phone number or name, even when the driver error quotes them.
 */

const PHONE = "+905320000094";
const NAME = "Gizli Hasta";

/** Fails like Drizzle does: the message lists the query parameters. */
function failingDb(): Database {
  return new Proxy(
    {},
    {
      get() {
        return () => {
          throw new Error(
            `Failed query: insert into "patients" values ($1, $2)\nparams: ${NAME},${PHONE}`,
          );
        };
      },
    },
  ) as unknown as Database;
}

function context(): ToolContext {
  return {
    db: failingDb(),
    clinic: {
      clinic: {
        id: "00000000-0000-4000-8000-000000000001",
        timezone: "Europe/Istanbul",
        status: "active",
      } as Clinic,
      settings: parseClinicSettings({}),
    },
    callId: "00000000-0000-4000-8000-000000000002",
    callerPhone: PHONE,
    now: new Date("2026-10-04T09:00:00Z"),
    defer: () => {},
    smsDelivers: false,
    sendQueuedMessages: () => {},
  };
}

function captureLogs(): string[] {
  const lines: string[] = [];
  for (const level of ["log", "info", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
  }
  return lines;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tool failures are honest and leak nothing (R2 4k, 4l)", () => {
  it.each([
    [
      "book_appointment",
      {
        serviceId: "00000000-0000-4000-8000-000000000004",
        practitionerId: "00000000-0000-4000-8000-000000000005",
        date: "2026-10-05",
        time: "10:00",
        patientName: NAME,
      },
    ],
    ["find_appointments", {}],
    ["cancel_appointment", { appointmentId: "00000000-0000-4000-8000-000000000003" }],
    ["create_callback_request", { reason: "Lütfen arayın", patientName: NAME }],
  ])(
    "%s with the database down: ok false, INTERNAL_ERROR, no success words",
    async (name, args) => {
      const lines = captureLogs();
      const result = await runTool(name, args, context());
      expect(result.ok).toBe(false);
      expect(result).toMatchObject({ error: "INTERNAL_ERROR" });
      expect(JSON.stringify(result)).not.toMatch(/oluşturuldu|alındı|iptal edildi|kaydedildi/);
      const output = lines.join("\n");
      expect(output).not.toContain("5320000094");
      expect(output).not.toContain(NAME);
    },
  );

  it("VOICE_TOOL_FAILSAFE: the failure before the tool logs no parameters either", async () => {
    const lines = captureLogs();
    const raw = JSON.stringify({
      name: "book_appointment",
      args: { patientName: NAME },
      call: { call_id: "c", agent_id: "a", call_type: "phone_call", from_number: PHONE },
    });
    const response = await handleFunctionCall(
      new Request("https://recall.test/api/voice/retell/tools", {
        method: "POST",
        headers: { "x-retell-signature": await sign(raw, "key_test_0123456789") },
        body: raw,
      }),
      {
        db: failingDb(),
        apiKey: "key_test_0123456789",
        now: () => new Date(),
        defer: () => {},
        smsDelivers: false,
        toolFailsafe: true,
        dispatchClinic: async () => {},
        deleteProviderCall: async () => {},
      },
    );
    expect((await response.json()).ok).toBe(false);
    const output = lines.join("\n");
    expect(output).toContain("retell.tool.unavailable");
    expect(output).not.toContain("5320000094");
    expect(output).not.toContain(NAME);
  });
});
