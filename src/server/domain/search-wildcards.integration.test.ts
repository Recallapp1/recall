import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb } from "@/test/db";

import type { Database } from "../db";
import { patients } from "../db/schema";
import { containing, listPatients, scopeFor } from "./panel";

/* Gap review G-07 (= P-23): "%" and "_" typed into panel search are literal. */

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

describe("panel search wildcards (G-07)", () => {
  it("escapes %, _ and the escape character itself", () => {
    expect(containing("ayşe")).toBe("%ayşe%");
    expect(containing("50%")).toBe("%50\\%%");
    expect(containing("a_b")).toBe("%a\\_b%");
    expect(containing("a\\b")).toBe("%a\\\\b%");
  });

  it("a search for _ or % no longer lists every patient", async () => {
    const clinic = await createTestClinic(db);
    await db.insert(patients).values([
      { clinicId: clinic.ctx.clinic.id, fullName: "Ayşe Yılmaz", phone: "+905320000601" },
      { clinicId: clinic.ctx.clinic.id, fullName: "Mehmet Kaya", phone: "+905320000602" },
    ]);
    const search = (text: string) =>
      listPatients(db, scopeFor(clinic.ctx), {
        search: text,
        limit: 50,
        offset: 0,
        now: new Date("2026-10-04T09:00:00Z"),
      });
    expect((await search("_")).rows).toHaveLength(0);
    expect((await search("%")).rows).toHaveLength(0);
    expect((await search("yılmaz")).rows.map((r) => r.fullName)).toEqual(["Ayşe Yılmaz"]);
  });
});
