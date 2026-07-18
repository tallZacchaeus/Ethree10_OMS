export type ReadinessStatus = "pass" | "warn" | "fail";

export type ReadinessCheck = {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
};

type EnvLike = Record<string, string | undefined>;

const REQUIRED_ENV_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "NEXTAUTH_URL",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "REDIS_URL",
  "INTEGRATION_SECRET_KEY",
  "STORAGE_ENDPOINT",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "STORAGE_BUCKET",
  "STORAGE_PUBLIC_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_STORAGE_URL",
] as const;

const PLACEHOLDER_PATTERNS = [
  /^$/,
  /replace/i,
  /change/i,
  /example/i,
  /mock/i,
  /^re_replace_me$/,
  /^sk_test_mock$/,
  /^whsec_mock$/,
  /^a{64}$/,
];

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

function isPlaceholder(value: string | undefined) {
  return !present(value) || PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function isUrl(value: string | undefined) {
  if (!present(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isHttps(value: string | undefined) {
  if (!present(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function sameOrigin(a: string | undefined, b: string | undefined) {
  if (!isUrl(a) || !isUrl(b)) return false;
  return new URL(a as string).origin === new URL(b as string).origin;
}

function nodeMajor(version: string) {
  const match = version.match(/^v?(\d+)/);
  return match ? Number(match[1]) : Number.NaN;
}

function check(key: string, label: string, status: ReadinessStatus, detail: string): ReadinessCheck {
  return { key, label, status, detail };
}

export function evaluateEnvironmentReadiness(
  env: EnvLike,
  options: { production?: boolean; nodeVersion?: string } = {},
): ReadinessCheck[] {
  const production = options.production ?? env["NODE_ENV"] === "production";
  const checks: ReadinessCheck[] = [];

  const missing = REQUIRED_ENV_KEYS.filter((key) => !present(env[key]));
  checks.push(
    check(
      "env.required",
      "Required environment variables",
      missing.length === 0 ? "pass" : "fail",
      missing.length === 0 ? "All required variables are present." : `Missing: ${missing.join(", ")}`,
    ),
  );

  const placeholderKeys = REQUIRED_ENV_KEYS.filter((key) => isPlaceholder(env[key]));
  checks.push(
    check(
      "env.placeholders",
      "Production placeholders",
      placeholderKeys.length === 0 ? "pass" : production ? "fail" : "warn",
      placeholderKeys.length === 0
        ? "No required variable is using a placeholder value."
        : `Replace placeholder values for: ${placeholderKeys.join(", ")}`,
    ),
  );

  const urlKeys = ["AUTH_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL", "STORAGE_PUBLIC_URL", "NEXT_PUBLIC_STORAGE_URL"];
  const invalidUrls = urlKeys.filter((key) => present(env[key]) && !isUrl(env[key]));
  checks.push(
    check(
      "env.urls",
      "URL syntax",
      invalidUrls.length === 0 ? "pass" : "fail",
      invalidUrls.length === 0 ? "URL variables are syntactically valid." : `Invalid URLs: ${invalidUrls.join(", ")}`,
    ),
  );

  checks.push(
    check(
      "auth.url-alignment",
      "Auth URL alignment",
      sameOrigin(env["AUTH_URL"], env["NEXTAUTH_URL"]) && sameOrigin(env["AUTH_URL"], env["NEXT_PUBLIC_APP_URL"])
        ? "pass"
        : "fail",
      "AUTH_URL, NEXTAUTH_URL, and NEXT_PUBLIC_APP_URL must share the same public origin.",
    ),
  );

  const publicUrls = ["AUTH_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL", "STORAGE_PUBLIC_URL", "NEXT_PUBLIC_STORAGE_URL"];
  const nonHttps = publicUrls.filter((key) => present(env[key]) && !isHttps(env[key]));
  checks.push(
    check(
      "env.https",
      "HTTPS public URLs",
      production && nonHttps.length > 0 ? "fail" : nonHttps.length > 0 ? "warn" : "pass",
      nonHttps.length === 0 ? "Public URLs use HTTPS." : `Non-HTTPS URLs: ${nonHttps.join(", ")}`,
    ),
  );

  const integrationKey = env["INTEGRATION_SECRET_KEY"] ?? "";
  checks.push(
    check(
      "integrations.secret",
      "Integration encryption key",
      /^[0-9a-f]{64}$/i.test(integrationKey) && integrationKey !== "a".repeat(64) ? "pass" : "fail",
      "INTEGRATION_SECRET_KEY must be a non-placeholder 64-character hex key.",
    ),
  );

  const nodeVersion = options.nodeVersion ?? process.version;
  const major = nodeMajor(nodeVersion);
  checks.push(
    check(
      "runtime.node",
      "Node runtime",
      major === 24 ? "pass" : "fail",
      `Expected Node 24.x for deployment; current runtime is ${nodeVersion}.`,
    ),
  );

  const paystackMissing = ["PAYSTACK_SECRET_KEY", "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY"].filter((key) => isPlaceholder(env[key]));
  checks.push(
    check(
      "payments.paystack",
      "Paystack keys",
      paystackMissing.length === 0 ? "pass" : production ? "fail" : "warn",
      paystackMissing.length === 0
        ? "Paystack server and public keys are configured."
        : `Configure before paid invoices: ${paystackMissing.join(", ")}`,
    ),
  );

  const optionalWarnings = ["NEXT_PUBLIC_POSTHOG_KEY", "SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"].filter((key) => isPlaceholder(env[key]));
  checks.push(
    check(
      "observability.keys",
      "Observability keys",
      optionalWarnings.length === 0 ? "pass" : "warn",
      optionalWarnings.length === 0
        ? "Analytics and error reporting keys are configured."
        : `Recommended before launch: ${optionalWarnings.join(", ")}`,
    ),
  );

  return checks;
}

export type DatabaseReadinessCounts = {
  teams: number;
  teamsWithHeads: number;
  services: number;
  acceptedStaff: number;
  superAdmins: number;
  organizations: number;
};

export function evaluateDatabaseReadiness(counts: DatabaseReadinessCounts): ReadinessCheck[] {
  return [
    check(
      "data.teams",
      "Canonical teams",
      counts.teams >= 2 ? "pass" : "fail",
      `Found ${counts.teams} active teams; expected Product Development and Brands & Communications.`,
    ),
    check(
      "data.team-heads",
      "Team heads",
      counts.teams > 0 && counts.teamsWithHeads === counts.teams ? "pass" : "warn",
      `${counts.teamsWithHeads}/${counts.teams} active teams have a lead assigned.`,
    ),
    check(
      "data.services",
      "Service catalog",
      counts.services > 0 ? "pass" : "fail",
      `Found ${counts.services} active services.`,
    ),
    check(
      "data.staff",
      "Accepted staff",
      counts.acceptedStaff > 1 ? "pass" : "warn",
      `Found ${counts.acceptedStaff} accepted staff memberships.`,
    ),
    check(
      "data.super-admin",
      "Super admin",
      counts.superAdmins > 0 ? "pass" : "fail",
      `Found ${counts.superAdmins} super-admin users.`,
    ),
    check(
      "data.organizations",
      "Organizations",
      counts.organizations > 0 ? "pass" : "warn",
      `Found ${counts.organizations} organizations.`,
    ),
  ];
}

export function summarizeReadiness(checks: ReadinessCheck[]) {
  return {
    passed: checks.filter((item) => item.status === "pass").length,
    warnings: checks.filter((item) => item.status === "warn").length,
    failures: checks.filter((item) => item.status === "fail").length,
  };
}

export function formatReadinessReport(checks: ReadinessCheck[]) {
  const icon: Record<ReadinessStatus, string> = { pass: "PASS", warn: "WARN", fail: "FAIL" };
  const lines = checks.map((item) => `${icon[item.status]} ${item.label}: ${item.detail}`);
  const summary = summarizeReadiness(checks);
  return [
    "Ethree10 launch readiness",
    `Summary: ${summary.passed} passed, ${summary.warnings} warnings, ${summary.failures} failures`,
    "",
    ...lines,
  ].join("\n");
}
