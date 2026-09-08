import { describe, it, expect } from "vitest";
import { devLoginEnabled, devLoginRisk } from "@/server/auth/dev-login";

describe("dev login availability", () => {
  it("is available in development", () => {
    expect(devLoginEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("is available in test", () => {
    expect(devLoginEnabled({ NODE_ENV: "test" })).toBe(true);
  });

  it("is REFUSED in production even when E2E_TEST_AUTH is set", () => {
    // The whole point. Before this guard existed, one environment variable
    // turned the real deployment into password-less login as anyone.
    expect(
      devLoginEnabled({
        NODE_ENV: "production",
        E2E_TEST_AUTH: "true",
        NEXT_PUBLIC_APP_URL: "https://oms.ethree10.com",
      }),
    ).toBe(false);
  });

  it("is refused in production with no E2E flag at all", () => {
    expect(
      devLoginEnabled({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://oms.ethree10.com" }),
    ).toBe(false);
  });

  it("stays available for the E2E suite, which runs a production build on localhost", () => {
    // CI builds and starts the app for real, so NODE_ENV is production there.
    // Removing this case would break every signed-in spec.
    expect(
      devLoginEnabled({
        NODE_ENV: "production",
        E2E_TEST_AUTH: "true",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    ).toBe(true);
  });

  it("accepts the other loopback spellings", () => {
    for (const url of ["http://127.0.0.1:3100", "http://[::1]:3000"]) {
      expect(
        devLoginEnabled({ NODE_ENV: "production", E2E_TEST_AUTH: "true", NEXT_PUBLIC_APP_URL: url }),
      ).toBe(true);
    }
  });

  it("fails closed when the app URL is missing", () => {
    // No URL is not evidence of localhost. Absence must never read as consent.
    expect(devLoginEnabled({ NODE_ENV: "production", E2E_TEST_AUTH: "true" })).toBe(false);
  });

  it("fails closed when the app URL is unparseable", () => {
    expect(
      devLoginEnabled({
        NODE_ENV: "production",
        E2E_TEST_AUTH: "true",
        NEXT_PUBLIC_APP_URL: "not a url",
      }),
    ).toBe(false);
  });

  it("is not fooled by a hostname that merely contains 'localhost'", () => {
    for (const url of [
      "https://localhost.evil.com",
      "https://notlocalhost",
      "https://oms.ethree10.com/localhost",
    ]) {
      expect(
        devLoginEnabled({ NODE_ENV: "production", E2E_TEST_AUTH: "true", NEXT_PUBLIC_APP_URL: url }),
      ).toBe(false);
    }
  });

  it("is not fooled by credentials or a port that look like loopback", () => {
    expect(
      devLoginEnabled({
        NODE_ENV: "production",
        E2E_TEST_AUTH: "true",
        NEXT_PUBLIC_APP_URL: "https://localhost@oms.ethree10.com",
      }),
    ).toBe(false);
  });
});

describe("dev login risk reporting", () => {
  it("reports nothing when the flag is absent", () => {
    expect(
      devLoginRisk({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://oms.ethree10.com" }),
    ).toBeNull();
  });

  it("reports nothing for a legitimate localhost E2E run", () => {
    expect(
      devLoginRisk({
        NODE_ENV: "production",
        E2E_TEST_AUTH: "true",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    ).toBeNull();
  });

  it("names the offending URL when the flag is set on real production", () => {
    const risk = devLoginRisk({
      NODE_ENV: "production",
      E2E_TEST_AUTH: "true",
      NEXT_PUBLIC_APP_URL: "https://oms.ethree10.com",
    });
    expect(risk).toContain("E2E_TEST_AUTH");
    expect(risk).toContain("https://oms.ethree10.com");
  });

  it("still reports when the flag is set with no URL", () => {
    expect(devLoginRisk({ NODE_ENV: "production", E2E_TEST_AUTH: "true" })).toContain(
      "E2E_TEST_AUTH",
    );
  });
});
