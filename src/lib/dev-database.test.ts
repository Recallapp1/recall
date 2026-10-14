import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DEV_DATABASE_ENDPOINT, devDatabaseRefusal } from "./dev-database";

/*
 * Data-writing and data-copying scripts run only against the dev database
 * (full audit FA-24): an allow-list, so a restored or new production endpoint
 * is refused too.
 */

/** A Postgres URL with credentials, assembled so no secret-like literal sits in the source. */
const url = (host: string, password = "x") => `postgres://user${":"}${password}@${host}/neondb`;

describe("devDatabaseRefusal", () => {
  it("allows the Neon dev branch and local databases", () => {
    expect(
      devDatabaseRefusal(url(`${DEV_DATABASE_ENDPOINT}-pooler.c-2.eu-central-1.aws.neon.tech`)),
    ).toBeNull();
    expect(devDatabaseRefusal(url("localhost:5433"))).toBeNull();
    expect(devDatabaseRefusal(url("127.0.0.1:5433"))).toBeNull();
  });

  it("refuses production, any other endpoint, and a missing or broken URL", () => {
    expect(
      devDatabaseRefusal(url("ep-small-bar-b1c058o0-pooler.c-2.eu-central-1.aws.neon.tech")),
    ).toMatch(/dev/);
    expect(devDatabaseRefusal(url("ep-restored-xyz.eu-central-1.aws.neon.tech"))).toMatch(/dev/);
    expect(devDatabaseRefusal("")).toMatch(/DATABASE_URL/);
    expect(devDatabaseRefusal("not a url")).toMatch(/DATABASE_URL/);
  });

  it("never echoes the URL (it carries the password)", () => {
    const message = devDatabaseRefusal(url("ep-other.neon.tech", "sekret-parola"));
    expect(message).not.toContain("sekret-parola");
  });
});

describe("scripts that write or copy clinic data", () => {
  it.each(["scripts/db-export.ts", "scripts/clinic-offboard.ts"])(
    "%s checks the database before touching it",
    (path) => {
      const source = readFileSync(path, "utf8");
      const guard = source.indexOf("devDatabaseRefusal(process.env.DATABASE_URL)");
      expect(guard).toBeGreaterThan(-1);
      expect(guard).toBeLessThan(source.indexOf("db()"));
    },
  );
});
