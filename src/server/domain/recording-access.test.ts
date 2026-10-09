import { describe, expect, it } from "vitest";

import { recordingTarget } from "./recording-access";

const call = {
  clinicId: "clinic-a",
  provider: "retell",
  providerCallId: "call_1",
  recordingUrl: "https://rec.test/x.wav",
};
const expected = { clinicId: "clinic-a", providers: ["retell"] };

describe("recordingTarget", () => {
  it("returns the provider call for the clinic's own recorded call", () => {
    expect(recordingTarget(call, expected)).toEqual({
      provider: "retell",
      providerCallId: "call_1",
    });
  });

  it("refuses another clinic's row, an unknown provider, a missing id or no recording", () => {
    expect(recordingTarget({ ...call, clinicId: "clinic-b" }, expected)).toBeNull();
    expect(recordingTarget({ ...call, provider: "other" }, expected)).toBeNull();
    expect(recordingTarget({ ...call, providerCallId: " " }, expected)).toBeNull();
    expect(recordingTarget({ ...call, recordingUrl: null }, expected)).toBeNull();
  });
});
