import { db } from "../lib/db";
import { discover } from "./discover";
import { analyze } from "./analyze";
import { generateScripts } from "./script";
import { generateAssets } from "./assets";

/**
 * Skill 6 — Autonomous Workflow Orchestration.
 * Runs discover -> analyze -> script -> assets for one agent.
 * In APPROVAL mode drafts stop at PENDING_APPROVAL; in AUTO mode
 * the assets skill schedules them and the publish sweep posts them.
 */

export async function orchestrate(agentId: string): Promise<string> {
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error(`Agent ${agentId} not found`);
  if (agent.status === "PAUSED") return "Agent paused — skipped";

  const summary: string[] = [];

  const d = await discover(agentId);
  summary.push(`discover: ${d.collected} signals${d.notes.length ? ` (${d.notes.join("; ")})` : ""}`);

  const a = await analyze(agentId);
  summary.push(`analyze: ${a.analyzed} insights${a.notes.length ? ` (${a.notes.join("; ")})` : ""}`);

  const s = await generateScripts(agentId, 1);
  summary.push(`script: ${s.drafts} drafts${s.notes.length ? ` (${s.notes.join("; ")})` : ""}`);

  const g = await generateAssets(agentId);
  summary.push(`assets: ${g.rendered} slides rendered${g.notes.length ? ` (${g.notes.join("; ")})` : ""}`);

  summary.push(
    agent.mode === "AUTO"
      ? "mode: AUTO — new drafts scheduled for publishing"
      : "mode: APPROVAL — drafts awaiting your review"
  );

  return summary.join(" | ");
}
