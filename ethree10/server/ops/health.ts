import { Redis } from "ioredis";
import { db } from "@/server/db/client";

export type HealthStatus = "ok" | "degraded" | "fail";

export type HealthCheck = {
  name: string;
  status: HealthStatus;
  latencyMs: number;
  detail?: string;
};

export type HealthMode = "live" | "ready";

async function measure(name: string, fn: () => Promise<void>): Promise<HealthCheck> {
  const startedAt = Date.now();
  try {
    await fn();
    return { name, status: "ok", latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      name,
      status: "fail",
      latencyMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkDatabase() {
  await db.$queryRaw`SELECT 1`;
}

async function checkRedis() {
  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  try {
    await redis.connect();
    await redis.ping();
  } finally {
    redis.disconnect();
  }
}

export async function getHealth(mode: HealthMode = "live") {
  const checks: HealthCheck[] = [
    {
      name: "app",
      status: "ok",
      latencyMs: 0,
      detail: "Next.js server is responding.",
    },
  ];

  if (mode === "ready") {
    checks.push(await measure("database", checkDatabase));
    checks.push(await measure("redis", checkRedis));
  }

  const status: HealthStatus = checks.some((item) => item.status === "fail") ? "fail" : "ok";

  return {
    service: "ethree10-oms",
    mode,
    status,
    timestamp: new Date().toISOString(),
    version: process.env["APP_VERSION"] ?? process.env["GITHUB_SHA"] ?? "local",
    checks,
  };
}
