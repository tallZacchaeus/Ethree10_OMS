import { describe, expect, it } from "vitest";

describe("app/api/health/route", () => {
  it("is dynamic and runs on Node.js", async () => {
    const route = (await import("@/app/api/health/route")) as {
      runtime?: string;
      dynamic?: string;
    };

    expect(route.runtime).toBe("nodejs");
    expect(route.dynamic).toBe("force-dynamic");
  });
});
