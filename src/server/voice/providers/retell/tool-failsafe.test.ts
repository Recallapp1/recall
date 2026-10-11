import { sign } from "retell-sdk";
import { describe, expect, it } from "vitest";

import type { Database } from "../../../db";
import { handleFunctionCall, TOOL_UNAVAILABLE, type RetellHandlerDeps } from "./handlers";

/*
 * Gap review G-03: the database fails before the tool even runs (the clinic
 * lookup). With VOICE_TOOL_FAILSAFE the assistant gets an honest ok: false;
 * unset keeps today's behaviour (the error escapes and the route answers 500).
 */

const API_KEY = "key_test_0123456789";

/** Every query fails, as when the database is unreachable. */
const brokenDb = new Proxy(
  {},
  {
    get() {
      return () => {
        throw new Error("connect ECONNREFUSED 10.0.0.1:5432 (simulated)");
      };
    },
  },
) as unknown as Database;

function deps(toolFailsafe?: boolean): RetellHandlerDeps {
  return {
    db: brokenDb,
    apiKey: API_KEY,
    now: () => new Date("2026-10-04T09:00:00Z"),
    defer: () => {},
    smsDelivers: false,
    ...(toolFailsafe !== undefined && { toolFailsafe }),
    dispatchClinic: async () => {},
    deleteProviderCall: async () => {},
  };
}

async function bookingRequest() {
  const raw = JSON.stringify({
    name: "book_appointment",
    args: {
      serviceId: "s",
      practitionerId: "p",
      date: "2026-10-05",
      time: "10:00",
      patientName: "Ayşe Yılmaz",
    },
    call: {
      call_id: "call_failsafe",
      agent_id: "agent_x",
      call_type: "phone_call",
      from_number: "+905320000078",
    },
  });
  return new Request("https://recall.test/api/voice/retell/tools", {
    method: "POST",
    headers: { "content-type": "application/json", "x-retell-signature": await sign(raw, API_KEY) },
    body: raw,
  });
}

describe("tool request when the database is down (G-03)", () => {
  it("switch unset: unchanged, the error escapes (the route answers HTTP 500)", async () => {
    await expect(handleFunctionCall(await bookingRequest(), deps())).rejects.toThrow(
      /ECONNREFUSED/,
    );
    await expect(handleFunctionCall(await bookingRequest(), deps(false))).rejects.toThrow();
  });

  it("VOICE_TOOL_FAILSAFE: an honest ok: false that never claims success", async () => {
    const response = await handleFunctionCall(await bookingRequest(), deps(true));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(TOOL_UNAVAILABLE);
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/oluşturuldu|onaylandı|iptal edildi/);
  });

  it("still rejects an unsigned request before anything else", async () => {
    const request = new Request("https://recall.test/api/voice/retell/tools", {
      method: "POST",
      body: "{}",
    });
    const response = await handleFunctionCall(request, deps(true));
    expect(response.status).toBe(401);
  });
});
