import { describe, expect, it } from "vitest";

import {
  CME_EVIDENCE_UPLOAD_NOT_EXERCISED,
  probeCmeEvidenceAndExportIsolation,
} from "../scripts/lib/cross-tenant-cme-evidence-probe";
import type { WriteProbeRequest } from "../scripts/lib/cross-tenant-write-probe";

// The evidence and export probe is exercised against a fake API that mirrors the real route
// order (validation, then the reason check on removal, then ownership), and against variants
// that each break one boundary the probe must catch.
type Leaks = {
  evidenceList?: boolean;
  evidenceDownload?: boolean;
  evidenceRemove?: boolean;
  exportOtherOwner?: boolean;
  exportOmitsOwn?: boolean;
  evidenceRouteBroken?: boolean;
};

const YEAR = 2000;
const ENTRY_ID = "00000000-0000-4000-8000-0000000000e1";
const MARKER = "probe-marker";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function fakeApi(leaks: Leaks = {}): WriteProbeRequest {
  const entries = new Map([[ENTRY_ID, { owner: "a", title: MARKER }]]);

  return async (token, path, init, expected) => {
    const method = init.method ?? "GET";
    const body = (init.body ?? null) as Record<string, unknown> | null;
    const reply = (status: number, payload: unknown = {}) => {
      if (!expected.includes(status))
        throw new Error(`${method} ${path}: status ${status}, expected ${expected.join("/")}`);
      return payload;
    };

    const evidence = path.match(/^\/api\/cme\/entries\/([^/?]+)\/evidence(?:\/([^/?]+))?$/);
    if (evidence) {
      const [, entryId, evidenceId] = evidence;
      if (!UUID.test(entryId!) || (evidenceId !== undefined && !UUID.test(evidenceId))) return reply(400);
      if (method === "DELETE") {
        const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
        if (reason.length < 3 || reason.length > 500) return reply(400);
      }
      const owned = entries.get(entryId!)?.owner === token;
      if (!evidenceId) {
        if (leaks.evidenceRouteBroken && token === "a") return reply(200, { error: "no list" });
        if (!owned && !leaks.evidenceList) return reply(404, { error: "Activity not found." });
        return reply(200, { evidence: [] });
      }
      if (method === "GET") {
        if (!owned && !leaks.evidenceDownload) return reply(404, { error: "Activity not found." });
        return reply(303);
      }
      if (method === "DELETE") {
        if (!owned && !leaks.evidenceRemove) return reply(404, { error: "Activity not found." });
        return reply(200, { evidence: { id: evidenceId, entryId } });
      }
    }

    if (path === `/api/cme/export?year=${YEAR}`) {
      const rows = [...entries.values()].filter(
        (entry) => leaks.exportOtherOwner || (entry.owner === token && !leaks.exportOmitsOwn),
      );
      if (token !== "a" && !leaks.exportOtherOwner) return reply(404, { error: "This CPD year is unavailable." });
      return reply(200, ['"CPD year","Activity"', ...rows.map((row) => `"${YEAR}","${row.title}"`)].join("\r\n"));
    }
    throw new Error(`unexpected ${method} ${path}`);
  };
}

function run(leaks: Leaks = {}) {
  return probeCmeEvidenceAndExportIsolation({
    request: fakeApi(leaks),
    tokenA: "a",
    tokenB: "b",
    entryId: ENTRY_ID,
    marker: MARKER,
    year: YEAR,
  });
}

describe("CME evidence and export cross-tenant probe", () => {
  it("passes against an API that isolates owners, and records that evidence upload was not exercised", async () => {
    await expect(run()).resolves.toEqual({
      checkpoints: ["cme-evidence-isolation", "cme-export-isolation"],
      skipped: [CME_EVIDENCE_UPLOAD_NOT_EXERCISED],
    });
  });

  it("refuses to run without user A's entry id or marker", async () => {
    await expect(
      probeCmeEvidenceAndExportIsolation({
        request: fakeApi(),
        tokenA: "a",
        tokenB: "b",
        entryId: "",
        marker: MARKER,
        year: YEAR,
      }),
    ).rejects.toThrow(/needs user A's entry id and marker/);
  });

  it.each([
    ["an evidence route that gives the owner no list", { evidenceRouteBroken: true }, /User A could not list evidence/],
    [
      "an evidence list open to another owner",
      { evidenceList: true },
      /GET \/api\/cme\/entries\/[^/]+\/evidence: status 200, expected 404/,
    ],
    [
      "an evidence download link issued to another owner",
      { evidenceDownload: true },
      /GET \/api\/cme\/entries\/[^/]+\/evidence\/[^:]+: status 303, expected 404/,
    ],
    [
      "an evidence removal accepted from another owner",
      { evidenceRemove: true },
      /DELETE \/api\/cme\/entries\/[^/]+\/evidence\/[^:]+: status 200, expected 404/,
    ],
    ["an export that includes another owner's entry", { exportOtherOwner: true }, /User B's CME export contained/],
    ["an export that omits the owner's own entry", { exportOmitsOwn: true }, /export did not contain its own/],
  ] satisfies [string, Leaks, RegExp][])("fails on %s", async (_label, leaks, message) => {
    await expect(run(leaks)).rejects.toThrow(message);
  });
});
