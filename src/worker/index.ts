import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { db } from "../lib/db";
import {
  QUEUE_NAME,
  redisConnection,
  ensurePublishSweep,
  scheduleAgentOrchestration,
} from "../lib/queue";
import { discover } from "../skills/discover";
import { analyze } from "../skills/analyze";
import { generateScripts } from "../skills/script";
import { generateAssets } from "../skills/assets";
import { publishDraft, publishDue } from "../skills/publish";
import { orchestrate } from "../skills/orchestrate";

/**
 * Background worker: processes all agent jobs and registers repeatable
 * schedules (per-agent orchestration cron + 5-minute publish sweep).
 * Run with: npm run worker
 */

async function process_(job: Job): Promise<string> {
  const agentId = job.data.agentId as string | undefined;
  switch (job.name) {
    case "orchestrate":
      return orchestrate(agentId!);
    case "discover": {
      const r = await discover(agentId!);
      return `collected ${r.collected}${r.notes.length ? `; ${r.notes.join("; ")}` : ""}`;
    }
    case "analyze": {
      const r = await analyze(agentId!);
      return `analyzed ${r.analyzed}${r.notes.length ? `; ${r.notes.join("; ")}` : ""}`;
    }
    case "script": {
      const r = await generateScripts(agentId!);
      return `created ${r.drafts} draft(s)${r.notes.length ? `; ${r.notes.join("; ")}` : ""}`;
    }
    case "assets": {
      const r = await generateAssets(agentId!, job.data.draftId as string | undefined);
      return `rendered ${r.rendered} slide(s)${r.notes.length ? `; ${r.notes.join("; ")}` : ""}`;
    }
    case "publish": {
      const r = await publishDraft(job.data.draftId as string);
      return `published: ${r.igMediaId}`;
    }
    case "publish-due": {
      const r = await publishDue();
      return `enqueued ${r.enqueued} due draft(s)`;
    }
    default:
      throw new Error(`Unknown job: ${job.name}`);
  }
}

async function main() {
  // Register schedules
  await ensurePublishSweep();
  const agents = await db.agent.findMany({ where: { status: "ACTIVE" } });
  for (const a of agents) {
    try {
      await scheduleAgentOrchestration(a.id, a.scheduleCron);
    } catch (e) {
      console.error(`Failed to schedule agent ${a.id}:`, (e as Error).message);
    }
  }
  console.log(`Scheduled ${agents.length} active agent(s) + publish sweep.`);

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const agentId = job.data.agentId as string | undefined;
      const log =
        agentId && job.name !== "publish-due"
          ? await db.runLog.create({ data: { agentId, jobType: job.name } })
          : null;
      try {
        const message = await process_(job);
        if (log) {
          await db.runLog.update({
            where: { id: log.id },
            data: { status: "SUCCESS", message: message.slice(0, 2000), finishedAt: new Date() },
          });
        }
        return message;
      } catch (e) {
        if (log) {
          await db.runLog.update({
            where: { id: log.id },
            data: { status: "FAILED", message: (e as Error).message.slice(0, 2000), finishedAt: new Date() },
          });
        }
        throw e;
      }
    },
    { connection: redisConnection(), concurrency: 2 }
  );

  worker.on("completed", (job) => console.log(`[ok] ${job.name} (${job.id})`));
  worker.on("failed", (job, err) =>
    console.error(`[fail] ${job?.name} (${job?.id}) attempt ${job?.attemptsMade}: ${err.message}`)
  );

  const shutdown = async () => {
    console.log("Shutting down worker...");
    await worker.close();
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("Worker started. Waiting for jobs...");
}

main().catch((e) => {
  console.error("Worker failed to start:", e);
  process.exit(1);
});
