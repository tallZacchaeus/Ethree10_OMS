import { Queue } from "bullmq";
import type { RedisOptions } from "bullmq";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

export const redisConnection: RedisOptions = {
  url: REDIS_URL,
  maxRetriesPerRequest: null,
};

export const queues = {
  notifications: new Queue("notifications", { connection: redisConnection }),
  reports: new Queue("reports", { connection: redisConnection }),
  integrations: new Queue("integrations", { connection: redisConnection }),
} as const;
