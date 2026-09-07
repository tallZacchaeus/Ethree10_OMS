/**
 * Whether the password-less "Local Dev Login" provider may be registered.
 *
 * That provider signs anyone in from an email address alone, and creates the
 * user if it does not exist. In production it is a complete authentication
 * bypass: type the Chief Executive's address, become them.
 *
 * It used to be gated on `NODE_ENV === "development" || E2E_TEST_AUTH === "true"`.
 * The second half of that has no production guard at all, so a single
 * environment variable — set by accident, copied from a CI file, or left behind
 * after debugging — silently opened every account in the agency.
 *
 * The variable cannot simply be banned outright, because the E2E suite needs
 * exactly this provider and runs against a *production build* (`next build` and
 * `next start`), so `NODE_ENV` is `production` there too. What separates that
 * run from the real thing is not the build, it is where the app is serving:
 * the E2E job points `NEXT_PUBLIC_APP_URL` at localhost, and production points
 * it at the public domain.
 *
 * So the rule is: outside production, always available. Inside a production
 * build, only when the run both asks for it *and* is serving on loopback.
 * Real production fails the second condition no matter what is set, and the
 * check fails closed when the URL is missing or unparseable.
 */
export type DevLoginEnv = {
  NODE_ENV?: string | undefined;
  E2E_TEST_AUTH?: string | undefined;
  NEXT_PUBLIC_APP_URL?: string | undefined;
};

/** Hosts that cannot be the public internet. */
function isLoopbackUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  let host: string;
  try {
    host = new URL(rawUrl).hostname;
  } catch {
    // An unparseable URL tells us nothing, and "nothing" must not mean "allow".
    return false;
  }
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}

export function devLoginEnabled(env: DevLoginEnv): boolean {
  if (env.NODE_ENV !== "production") return true;
  if (env.E2E_TEST_AUTH !== "true") return false;
  return isLoopbackUrl(env.NEXT_PUBLIC_APP_URL);
}

/**
 * Explains a refusal, for the readiness check. Returns null when dev login is
 * off for the ordinary reason (nobody asked for it).
 */
export function devLoginRisk(env: DevLoginEnv): string | null {
  if (env.NODE_ENV !== "production") return null;
  if (env.E2E_TEST_AUTH !== "true") return null;
  if (isLoopbackUrl(env.NEXT_PUBLIC_APP_URL)) return null;
  return (
    `E2E_TEST_AUTH is set on a production build serving ${env.NEXT_PUBLIC_APP_URL ?? "(no app URL)"}. ` +
    "Password-less login is refused, but the variable should not be set here at all."
  );
}
