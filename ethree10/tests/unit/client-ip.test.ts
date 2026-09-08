import { describe, it, expect } from "vitest";
import { clientIp } from "@/server/security/client-ip";

const h = (init: Record<string, string>) => new Headers(init);

describe("client IP extraction", () => {
  it("takes the last hop, not the first", () => {
    // nginx appends the real peer. The first entry is whatever the client
    // claimed, so trusting it hands the attacker their own rate-limit bucket.
    expect(clientIp(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("handles a single-hop header", () => {
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("tolerates untidy spacing", () => {
    expect(clientIp(h({ "x-forwarded-for": "  1.2.3.4 ,  203.0.113.9  " }))).toBe("203.0.113.9");
  });

  it("ignores empty entries a spoofer might pad with", () => {
    expect(clientIp(h({ "x-forwarded-for": "1.2.3.4, , ,203.0.113.9, ," }))).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(h({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    expect(
      clientIp(h({ "x-forwarded-for": "203.0.113.9", "x-real-ip": "198.51.100.7" })),
    ).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip when forwarded-for is present but empty", () => {
    expect(clientIp(h({ "x-forwarded-for": "  ,  ", "x-real-ip": "198.51.100.7" }))).toBe(
      "198.51.100.7",
    );
  });

  it("returns a shared bucket rather than nothing when no header is present", () => {
    // Never returns empty. An empty key would collapse into one hash and could
    // read as "no limit" to a future caller; "unknown" is explicit and still
    // limits, which is the safe direction to fail.
    expect(clientIp(h({}))).toBe("unknown");
  });

  it("keeps IPv6 addresses intact", () => {
    expect(clientIp(h({ "x-forwarded-for": "1.2.3.4, 2001:db8::1" }))).toBe("2001:db8::1");
  });
});
