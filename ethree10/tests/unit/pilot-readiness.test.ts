import { describe, expect, it } from "vitest";
import { evaluatePilotReadiness } from "@/scripts/check-pilot-readiness";

describe("pilot readiness", () => {
  it("keeps first-user acceptance materials complete", async () => {
    const checks = await evaluatePilotReadiness();
    expect(checks.filter((check) => !check.pass)).toEqual([]);
  });
});
