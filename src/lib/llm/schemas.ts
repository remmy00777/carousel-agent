import { z } from "zod";

export const InsightSchema = z.object({
  hookStyle: z.string().min(1),
  emotionalAngle: z.string().min(1),
  painPoint: z.string().min(1),
  structure: z.string().min(1),
  cta: z.string().min(1),
  topicCluster: z.string().min(1),
  visualPattern: z.string().min(1),
  strategicInsight: z.string().min(1),
  score: z.number().min(0).max(100),
});
export type InsightData = z.infer<typeof InsightSchema>;

export const ScriptSchema = z.object({
  title: z.string().min(1),
  slides: z
    .array(z.object({ heading: z.string().min(1), body: z.string() }))
    .min(5)
    .max(10),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).min(3).max(30),
  altTexts: z.array(z.string()),
  rationale: z.string(),
});
export type ScriptData = z.infer<typeof ScriptSchema>;
