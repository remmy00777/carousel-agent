import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

export const QUEUE_NAME = "agent-jobs";

export const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 10_000 },
  removeOnComplete: 200,
  removeOnFail: 1000,
};

export function redisConnection(): ConnectionOptions {
  // Cast needed: bullmq bundles its own ioredis type copy, which is
  // structurally identical but nominally different from ours.
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  }) as unknown as ConnectionOptions;
}

let queue: Queue | null = null;

export function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: redisConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTS,
    });
  }
  return queue;
}

export type JobName =
  | "orchestrate"
  | "discover"
  | "analyze"
  | "script"
  | "assets"
  | "publish"
  | "publish-due";

export async function enqueue(name: JobName, data: Record<string, unknown>, opts?: JobsOptions) {
  await getQueue().add(name, data, opts);
}

/** Register (or replace) the repeatable orchestration job for an agent. */
export async function scheduleAgentOrchestration(agentId: string, cron: string) {
  const q = getQueue();
  await unscheduleAgent(agentId);
  await q.add(
    "orchestrate",
    { agentId },
    { repeat: { pattern: cron }, jobId: `orch:${agentId}` }
  );
}

export async function unscheduleAgent(agentId: string) {
  const q = getQueue();
  const reps = await q.getRepeatableJobs();
  for (const r of reps) {
    if (r.id === `orch:${agentId}`) await q.removeRepeatableByKey(r.key);
  }
}

/** Sweep for due scheduled drafts every 5 minutes. */
export async function ensurePublishSweep() {
  const q = getQueue();
  const reps = await q.getRepeatableJobs();
  if (!reps.some((r) => r.id === "publish-due")) {
    await q.add("publish-due", {}, { repeat: { pattern: "*/5 * * * *" }, jobId: "publish-due" });
  }
}
