import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * A failed assistant sync after a settings change raises an alarm (full
 * audit FA-14): the assistant keeps its old prompt until someone acts.
 */

vi.mock("next/server", () => ({ after: (task: () => Promise<void>) => task() }));

afterEach(() => vi.restoreAllMocks());

function alarmLines() {
  const spy = vi.spyOn(console, "error");
  return () =>
    spy.mock.calls
      .map(([line]) => String(line))
      .filter((line) => line.includes('"msg":"ALARM"') && line.includes("voice.sync_failed"));
}

const CLINIC = "00000000-0000-4000-8000-000000000001";

describe("scheduleAssistantSync", () => {
  it("raises an alarm when the provider reports an error", async () => {
    const { scheduleAssistantSync } = await import("./schedule-sync");
    const lines = alarmLines();
    await scheduleAssistantSync(CLINIC, async () => ({ status: "error", error: "Retell 500" }));
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toContain(CLINIC);
  });

  it("raises an alarm when the sync throws", async () => {
    const { scheduleAssistantSync } = await import("./schedule-sync");
    const lines = alarmLines();
    await scheduleAssistantSync(CLINIC, async () => {
      throw new Error("network down");
    });
    expect(lines()).toHaveLength(1);
  });

  it("stays quiet when the sync succeeds or there is no agent", async () => {
    const { scheduleAssistantSync } = await import("./schedule-sync");
    const lines = alarmLines();
    await scheduleAssistantSync(CLINIC, async () => ({
      status: "updated",
      agentId: "agent_1",
      version: 2,
    }));
    await scheduleAssistantSync(CLINIC, async () => null);
    expect(lines()).toHaveLength(0);
  });
});
