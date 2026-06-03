import { describe, expect, it } from "vitest";

describe("app/api/cron/reports/route", () => {
  it("forces dynamic execution so builds do not trigger the cron handler", async () => {
    const route = (await import("@/app/api/cron/reports/route")) as {
      runtime?: string;
      dynamic?: string;
    };

    expect(route.runtime).toBe("nodejs");
    expect(route.dynamic).toBe("force-dynamic");
  });
});
