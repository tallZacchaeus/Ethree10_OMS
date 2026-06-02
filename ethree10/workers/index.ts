import { Worker } from "bullmq";
import { redisConnection, queues } from "./queues";
import { ReportService } from "../server/services/report";
import pino from "pino";

const logger = pino({ name: "worker" });

// ── Notifications worker ────────────────────────────────────────────────
const notificationsWorker = new Worker(
  "notifications",
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, "Processing notification job");
  },
  { connection: redisConnection },
);

// ── Reports worker ──────────────────────────────────────────────────────
const reportsWorker = new Worker(
  "reports",
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, "Processing report job");
    if (job.name === "weekly-report") {
      // The generateWeekly service should ideally handle idempotency or not run if already generated.
      await ReportService.generateWeekly({ actorId: "system" });
    }
  },
  { connection: redisConnection },
);

// ── Integrations worker ─────────────────────────────────────────────────
const integrationsWorker = new Worker(
  "integrations",
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, "Processing integration sync job");
  },
  { connection: redisConnection },
);

for (const worker of [notificationsWorker, reportsWorker, integrationsWorker]) {
  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Job failed");
  });
}

logger.info("Workers running. Waiting for jobs…");

// Schedule the weekly report job for Saturday 18:00 Africa/Lagos
queues.reports.add("weekly-report", {}, {
  repeat: {
    pattern: "0 18 * * 6",
    tz: "Africa/Lagos",
  }
}).catch(err => logger.error({ err }, "Failed to schedule weekly report job"));

process.on("SIGTERM", async () => {
  await Promise.all([
    notificationsWorker.close(),
    reportsWorker.close(),
    integrationsWorker.close(),
  ]);
  process.exit(0);
});
