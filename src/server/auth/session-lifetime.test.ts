import { describe, expect, it } from "vitest";

import { sessionLifetime } from ".";

/* Gap review G-05: PANEL_SESSION_HOURS; unset keeps today's 7 days. */

describe("sessionLifetime", () => {
  it("unset: 7 days, refreshed daily (unchanged)", () => {
    expect(sessionLifetime(undefined)).toEqual({ expiresIn: 604_800, updateAge: 86_400 });
  });

  it("a shift-length session refreshes well before it ends", () => {
    expect(sessionLifetime(12)).toEqual({ expiresIn: 43_200, updateAge: 10_800 });
    expect(sessionLifetime(1)).toEqual({ expiresIn: 3_600, updateAge: 900 });
    expect(sessionLifetime(168)).toEqual({ expiresIn: 604_800, updateAge: 86_400 });
  });
});
