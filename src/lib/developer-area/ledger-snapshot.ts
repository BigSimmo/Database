import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import snapshotJson from "../../../data/outstanding-issues-snapshot.json";

import { resolveFreshnessFrom, type Freshness } from "./freshness";

export const LEDGER_SNAPSHOT_VERSION = "outstanding-issues-snapshot-v1";

export type LedgerPriority = "P1" | "P2" | "P3";

export type LedgerOpenItem = {
  id: string;
  priority: string;
  type: string;
  summary: string;
  detail: string;
  source: string;
  added: string;
};

export type LedgerQueueEntry = {
  order: number;
  ids: string[];
  /** Urgency. Deliberately NOT derived from, or merged with, `LedgerOpenItem.priority`. */
  acuity: string;
  capability: string;
  timing: string;
  estimate: string;
  detail: string;
};

export type LedgerPendingRequest = {
  request_id: string;
  action: string;
  summary: string;
  created_at: string | null;
};

export type LedgerSnapshot = {
  version: string;
  ledger_revision: { sha: string; committed_at: string } | null;
  counts: { open: number; p1: number; p2: number; p3: number; queued: number; pending: number; resolved: number };
  queue: LedgerQueueEntry[];
  open: LedgerOpenItem[];
  pending: LedgerPendingRequest[];
};

function formatPendingRequest(record: {
  id: string;
  action: string;
  createdOn?: string;
  payload?: Record<string, unknown>;
}): LedgerPendingRequest {
  const payload = (record.payload ?? {}) as Record<string, unknown>;
  const target = payload.id ? `${payload.id}: ` : "";
  let summary: string;

  if (record.action === "update") {
    const changes = [
      payload.summary !== undefined ? `summary → ${String(payload.summary) || "(clear)"}` : null,
      payload.detail !== undefined ? `detail → ${String(payload.detail) || "(clear)"}` : null,
      payload.pri !== undefined ? `priority → ${String(payload.pri)}` : null,
      payload.source !== undefined ? `source → ${String(payload.source) || "(clear)"}` : null,
    ].filter(Boolean);
    summary = changes.length > 0 ? `${target}${changes.join("; ")}` : `${target}(no change in the update request)`;
  } else if (record.action === "cancel") {
    const request = payload.requestId ? `Cancel request ${String(payload.requestId)}` : "Cancel request";
    summary = `${request}: ${String(payload.reason ?? "") || "(no reason in the cancel request)"}`;
  } else {
    const body = String(payload.summary ?? payload.detail ?? payload.outcome ?? "");
    summary = body ? `${target}${body}` : `${target}(no summary in the ${record.action} request)`;
  }

  return {
    request_id: record.id,
    action: record.action,
    summary,
    created_at: record.createdOn ?? null,
  };
}

export function readLivePendingRequests(
  inboxDir = join(process.cwd(), "docs", "outstanding-issues-inbox"),
): LedgerPendingRequest[] {
  if (typeof window !== "undefined") return [];
  try {
    if (!existsSync(inboxDir)) return [];
    const entries = readdirSync(inboxDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .sort((a, b) => a.name.localeCompare(b.name));
    const results: LedgerPendingRequest[] = [];
    for (const entry of entries) {
      try {
        const content = readFileSync(join(inboxDir, entry.name), "utf8");
        const parsed = JSON.parse(content);
        if (
          parsed &&
          typeof parsed === "object" &&
          typeof parsed.id === "string" &&
          typeof parsed.action === "string"
        ) {
          results.push(formatPendingRequest(parsed));
        }
      } catch {
        // Skip unreadable or invalid json file
      }
    }
    return results;
  } catch {
    return [];
  }
}

export function loadLedgerSnapshot(): LedgerSnapshot {
  const snapshot = snapshotJson as LedgerSnapshot;
  if (snapshot.version !== LEDGER_SNAPSHOT_VERSION) {
    // Loud, not a render fallback: an unrecognised shape means the page would
    // silently under-report outstanding work, which is the `#338` failure.
    throw new Error(
      `Unrecognised ledger snapshot version ${snapshot.version}; expected ${LEDGER_SNAPSHOT_VERSION}. Run: npm run snapshot:issues`,
    );
  }
  if (process.env.NODE_ENV !== "production") {
    try {
      const livePending = readLivePendingRequests();
      return {
        ...snapshot,
        pending: livePending,
        counts: {
          ...snapshot.counts,
          pending: livePending.length,
        },
      };
    } catch {
      return snapshot;
    }
  }
  return snapshot;
}

export type { Freshness };

export function resolveFreshness(snapshot: LedgerSnapshot, now: Date): Freshness {
  return resolveFreshnessFrom(snapshot.ledger_revision?.committed_at ?? null, now);
}

export function openItemsByPriority(snapshot: LedgerSnapshot): Record<LedgerPriority, LedgerOpenItem[]> {
  const grouped: Record<LedgerPriority, LedgerOpenItem[]> = { P1: [], P2: [], P3: [] };
  for (const item of snapshot.open) {
    if (item.priority === "P1" || item.priority === "P2" || item.priority === "P3") grouped[item.priority].push(item);
  }
  return grouped;
}
