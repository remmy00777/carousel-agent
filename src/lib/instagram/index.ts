import { graphAdapter } from "./graph";
import { mockAdapter } from "./mock";
import type { InstagramAdapter } from "./types";

export type { DiscoveredMedia, IgAuth, InstagramAdapter } from "./types";

/** Adapter factory driven by IG_ADAPTER env (mock | graph). */
export function getInstagram(): InstagramAdapter {
  return (process.env.IG_ADAPTER ?? "mock").toLowerCase() === "graph"
    ? graphAdapter()
    : mockAdapter();
}
