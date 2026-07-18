import { pathToFileURL } from "node:url";

type EnvLike = Record<string, string | undefined>;

type MonitoringCheck = {
  name: string;
  pass: boolean;
  detail: string;
};

function present(value: string | undefined) {
  return Boolean(value?.trim());
}

function validUrl(value: string | undefined) {
  if (!present(value)) return false;
  try {
    new URL(value as string);
    return true;
  } catch {
    return false;
  }
}

function validEmail(value: string | undefined) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

export function evaluateMonitoringReadiness(env: EnvLike): MonitoringCheck[] {
  return [
    {
      name: "server error reporting",
      pass: validUrl(env["SENTRY_DSN"]),
      detail: "SENTRY_DSN must be configured for server-side exception reporting.",
    },
    {
      name: "client error reporting",
      pass: validUrl(env["NEXT_PUBLIC_SENTRY_DSN"]),
      detail: "NEXT_PUBLIC_SENTRY_DSN must be configured for browser exception reporting.",
    },
    {
      name: "product analytics",
      pass: present(env["NEXT_PUBLIC_POSTHOG_KEY"]) && validUrl(env["NEXT_PUBLIC_POSTHOG_HOST"] ?? "https://app.posthog.com"),
      detail: "NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST should be configured before onboarding users.",
    },
    {
      name: "alert destination",
      pass: validEmail(env["MONITORING_ALERT_EMAIL"]),
      detail: "MONITORING_ALERT_EMAIL should point to the team mailbox that handles incidents.",
    },
    {
      name: "uptime monitor target",
      pass: validUrl(env["UPTIME_MONITOR_URL"]) && (env["UPTIME_MONITOR_URL"] ?? "").includes("/api/health?mode=ready"),
      detail: "UPTIME_MONITOR_URL should target /api/health?mode=ready.",
    },
  ];
}

async function main() {
  const checks = evaluateMonitoringReadiness(process.env);
  const failed = checks.filter((check) => !check.pass);

  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  }

  if (failed.length > 0) {
    throw new Error(`Monitoring readiness failed: ${failed.map((check) => check.name).join(", ")}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
