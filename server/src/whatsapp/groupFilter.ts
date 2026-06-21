import { env } from "../config/env.js";
import type { GroupSummary } from "./state.js";

export function isGroupJid(jid?: string | null): boolean {
  return !!jid && jid.endsWith("@g.us");
}

/**
 * Resolves the target group JID from configuration:
 * - TARGET_GROUP_ID wins if set.
 * - Otherwise match TARGET_GROUP_NAME against the subjects of joined groups.
 */
export function resolveTargetJid(groups: GroupSummary[]): string | null {
  if (env.TARGET_GROUP_ID) return env.TARGET_GROUP_ID;
  if (env.TARGET_GROUP_NAME) {
    const wanted = env.TARGET_GROUP_NAME.trim();
    const match = groups.find((g) => g.subject.trim() === wanted);
    return match?.jid ?? null;
  }
  return null;
}
