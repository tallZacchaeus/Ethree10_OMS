import { describe, expect, it } from "vitest";

describe("security headers", () => {
  it("applies baseline browser protections to all routes", async () => {
    const config = (await import("../../next.config.mjs")) as {
      default: {
        headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>;
      };
    };

    const rules = await config.default.headers();
    const globalRule = rules.find((rule) => rule.source === "/:path*");
    const headers = Object.fromEntries(globalRule?.headers.map((header) => [header.key, header.value]) ?? []);

    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Content-Security-Policy-Report-Only"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy-Report-Only"]).toContain("https://checkout.paystack.com");
  });
});
