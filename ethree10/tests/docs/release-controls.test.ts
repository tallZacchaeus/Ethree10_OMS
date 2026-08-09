import { describe, expect, it } from "vitest";
import { evaluateReleaseControls } from "@/scripts/check-release-controls";

describe("release controls", () => {
  it("keeps required launch controls wired", async () => {
    const checks = await evaluateReleaseControls();
    expect(checks.filter((check) => !check.pass)).toEqual([]);
  });
});
