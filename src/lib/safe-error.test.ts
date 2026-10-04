import { describe, expect, it } from "vitest";

import { safeError } from "./safe-error";

describe("safeError", () => {
  it("drops query parameters that carry personal data", () => {
    const driver = Object.assign(new Error('relation "x" does not exist'), { code: "42P01" });
    const wrapped = new Error(
      'Failed query: insert into "patients" values ($1, $2)\nparams: Ayşe Yılmaz,+905321234567',
      { cause: driver },
    );
    const result = safeError(wrapped);
    expect(result).toEqual({
      name: "Error",
      code: "42P01",
      message: 'relation "x" does not exist',
    });
    expect(JSON.stringify(result)).not.toContain("Ayşe");
    expect(JSON.stringify(result)).not.toContain("+90532");
  });

  it("never returns the parameters of a wrapper without a cause", () => {
    const wrapped = new Error("Failed query: select 1\nparams: +905321234567");
    expect(safeError(wrapped).message).toBe("Failed query");
  });

  it("handles non-errors", () => {
    expect(safeError("boom")).toEqual({ name: "UnknownError", message: "non-error thrown" });
  });
});
