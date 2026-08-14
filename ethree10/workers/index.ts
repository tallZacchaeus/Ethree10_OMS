import { Worker } from "bullmq";
import { redisConnection, queues } from "./queues";
import { ReportService } from "../server/services/report";
import { InvoiceService } from "../server/services/invoice";
import { TaskService } from "../server/services/task";
import pino from "pino";
import { captureCriticalFailure, initMonitoring, recordJobSuccess } from "../lib/observability";

const logger = pino({ name: "worker" });

// The worker is a separate process from Next.js, so it needs its own
// monitoring init — the instrumentation hook does not run here.
initMonitoring("server");

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
      await ReportService.generateWeekly({ actorId: "system", anchor: new Date(Date.now() - 24 * 60 * 60 * 1000) });
    }
    if (job.name === "monthly-report") {
      await ReportService.generateMonthly({ actorId: "system", anchor: new Date(Date.now() - 24 * 60 * 60 * 1000) });
    }
    if (job.name === "mark-overdue-invoices") {
      const count = await InvoiceService.markOverdue();
      logger.info({ count }, "Marked overdue invoices");
    }
    if (job.name === "task-due-reminders") {
      const counts = await TaskService.notifyDueAndOverdue();
      logger.info(counts, "Sent task due/overdue reminders");
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
    // A silently failing worker is the whole reason monitoring exists: nobody
    // notices a report cycle that stopped running until someone asks for a report.
    captureCriticalFailure(
      worker.name === "reports" ? "report-cycle" : worker.name === "integrations" ? "integration-sync" : "notification-worker",
      err,
      { jobId: job?.id, jobName: job?.name, queue: worker.name },
    );
  });

  worker.on("completed", (job) => {
    if (job.name.endsWith("-report")) {
      recordJobSuccess("report-cycle", { jobName: job.name });
    }
  });
}

logger.info("Workers running. Waiting for jobs…");

// Generate the just-completed Lagos week after its Sunday cutoff.
queues.reports.add("weekly-report", {}, {
  repeat: {
    pattern: "15 0 * * 1",
    tz: "Africa/Lagos",
  }
}).catch(err => logger.error({ err }, "Failed to schedule weekly report job"));

// Generate the just-completed Lagos month on the first day of the next month.
queues.reports.add("monthly-report", {}, {
  repeat: {
    pattern: "30 0 1 * *",
    tz: "Africa/Lagos",
  }
}).catch(err => logger.error({ err }, "Failed to schedule monthly report job"));

// Flip overdue invoices daily at 06:00 Africa/Lagos
queues.reports.add("mark-overdue-invoices", {}, {
  repeat: {
    pattern: "0 6 * * *",
    tz: "Africa/Lagos",
  }
}).catch(err => logger.error({ err }, "Failed to schedule overdue-invoice job"));

// Remind on work due within 48h, and chase anything already late. 07:00 local,
// so it lands before the working day rather than overnight.
queues.reports.add("task-due-reminders", {}, {
  repeat: {
    pattern: "0 7 * * *",
    tz: "Africa/Lagos",
  }
}).catch(err => logger.error({ err }, "Failed to schedule task reminder job"));

process.on("SIGTERM", async () => {
  await Promise.all([
    notificationsWorker.close(),
    reportsWorker.close(),
    integrationsWorker.close(),
  ]);
  process.exit(0);
});
