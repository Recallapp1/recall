import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb } from "@/test/db";

import type { Database } from "../db";
import { calls, toolRequests } from "../db/schema";
import { requestKey, runOnce, STALE_PENDING_MS } from "./tool-requests";

const NOW = new Date("2026-10-04T09:00:00Z");

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

describe("requestKey", () => {
  it("prefers the provider's tool call id and ignores argument order otherwise", () => {
    expect(requestKey("book_appointment", { a: 1 }, "tc_1")).toBe("tc:tc_1");
    expect(requestKey("book_appointment", { a: 1, b: "x" }, null)).toBe(
      requestKey("book_appointment", { b: "x", a: 1 }, null),
    );
    expect(requestKey("book_appointment", { a: 1 }, null)).not.toBe(
      requestKey("cancel_appointment", { a: 1 }, null),
    );
  });
});

describe("runOnce", () => {
  it("takes over a claim abandoned for longer than the stale limit", async () => {
    const { ctx } = await createTestClinic(db);
    const [call] = await db
      .insert(calls)
      .values({ clinicId: ctx.clinic.id, provider: "retell", providerCallId: "stale-1" })
      .returning({ id: calls.id });
    const identity = {
      clinicId: ctx.clinic.id,
      callId: call!.id,
      tool: "book_appointment",
      requestKey: "args:stale",
    };
    const old = new Date(NOW.getTime() - STALE_PENDING_MS - 1000);
    await db
      .insert(toolRequests)
      .values({ ...identity, status: "pending", createdAt: old, updatedAt: old });

    let runs = 0;
    const outcome = await runOnce(db, identity, NOW, async () => {
      runs += 1;
      return { ok: true as const, value: 1 };
    });
    expect(outcome).toEqual({ kind: "ran", result: { ok: true, value: 1 } });
    expect(runs).toBe(1);
    const replay = await runOnce(db, identity, NOW, async () => ({ ok: true as const, value: 2 }));
    expect(replay).toEqual({ kind: "replayed", result: { ok: true, value: 1 } });
  });

  it("releases the claim when the run throws", async () => {
    const { ctx } = await createTestClinic(db);
    const [call] = await db
      .insert(calls)
      .values({ clinicId: ctx.clinic.id, provider: "retell", providerCallId: "throw-1" })
      .returning({ id: calls.id });
    const identity = {
      clinicId: ctx.clinic.id,
      callId: call!.id,
      tool: "cancel_appointment",
      requestKey: "args:throw",
    };
    await expect(
      runOnce(db, identity, NOW, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const again = await runOnce(db, identity, NOW, async () => ({ ok: true as const }));
    expect(again.kind).toBe("ran");
  });
});
