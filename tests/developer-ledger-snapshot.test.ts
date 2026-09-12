import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatInboxRecord,
  loadLedgerSnapshot,
  openItemsByPriority,
  resolveFreshness,
} from "@/lib/developer-area/ledger-snapshot";

describe("ledger snapshot", () => {
  it("loads the generated snapshot and validates its version", () => {
    const snapshot = loadLedgerSnapshot();
    expect(snapshot.version).toBe("outstanding-issues-snapshot-v2");
    expect(snapshot.counts.open).toBeGreaterThan(0);
  });

  it("groups open items by priority without inventing acuity", () => {
    const grouped = openItemsByPriority(loadLedgerSnapshot());
    expect(grouped.P1.every((item) => item.priority === "P1")).toBe(true);
    expect(grouped.P1.every((item) => !("acuity" in item))).toBe(true);
  });

  it("reports a gap between ledger content and build", () => {
    const snapshot = {
      ...loadLedgerSnapshot(),
      ledger_revision: { committed_at: "2026-08-20" },
    };
    const freshness = resolveFreshness(snapshot, new Date("2026-08-21T00:00:00Z"));
    expect(freshness.ageHours).toBe(24);
  });

  it("says the revision is unknown rather than fabricating a date", () => {
    const snapshot = { ...loadLedgerSnapshot(), ledger_revision: null };
    const freshness = resolveFreshness(snapshot, new Date("2026-08-21T00:00:00Z"));
    expect(freshness.contentAt).toBeNull();
    expect(freshness.ageHours).toBeNull();
  });

  it("reads live pending requests from inbox in non-production environments", () => {
    const snapshot = loadLedgerSnapshot();
    expect(Array.isArray(snapshot.pending)).toBe(true);
    expect(snapshot.counts.pending).toBe(snapshot.pending.length);
  });
});

describe("dev-only pending inbox loading (#707F09)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("populates pending requests and updates counts.pending in dev mode when inbox files exist", () => {
    vi.stubEnv("NODE_ENV", "development");

    const mockFiles: Record<string, string> = {
      "02-update.json": JSON.stringify({
        id: "req-update-1",
        action: "update",
        createdOn: "2026-09-10",
        payload: {
          id: "#123",
          summary: "Updated title",
          pri: "P1",
        },
      }),
      "01-new.json": JSON.stringify({
        id: "req-new-1",
        action: "new",
        createdOn: "2026-09-09",
        payload: {
          id: "#124",
          summary: "New clinical finding",
        },
      }),
      "03-cancel.json": JSON.stringify({
        id: "req-cancel-1",
        action: "cancel",
        createdOn: "2026-09-11",
        payload: {
          requestId: "req-old",
          reason: "duplicate of #123",
        },
      }),
    };

    vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      if (typeof p === "string" && p.includes("outstanding-issues-inbox")) return true;
      return false;
    });

    vi.spyOn(fs, "readdirSync").mockImplementation(((p: fs.PathLike) => {
      if (typeof p === "string" && p.includes("outstanding-issues-inbox")) {
        return [
          { name: "02-update.json", isFile: () => true },
          { name: "README.md", isFile: () => true },
          { name: "01-new.json", isFile: () => true },
          { name: "applied", isFile: () => false },
          { name: "03-cancel.json", isFile: () => true },
        ];
      }
      return [];
    }) as unknown as typeof fs.readdirSync);

    vi.spyOn(fs, "readFileSync").mockImplementation((p) => {
      const filename = path.basename(String(p));
      if (mockFiles[filename]) return mockFiles[filename];
      throw new Error(`File not found: ${String(p)}`);
    });

    const snapshot = loadLedgerSnapshot();

    expect(snapshot.counts.pending).toBe(3);
    expect(snapshot.pending).toHaveLength(3);

    // Sorted deterministically by filename (01-new.json, 02-update.json, 03-cancel.json)
    expect(snapshot.pending[0]).toEqual({
      request_id: "req-new-1",
      action: "new",
      summary: "#124: New clinical finding",
      created_at: "2026-09-09",
    });
    expect(snapshot.pending[1]).toEqual({
      request_id: "req-update-1",
      action: "update",
      summary: "#123: summary → Updated title; priority → P1",
      created_at: "2026-09-10",
    });
    expect(snapshot.pending[2]).toEqual({
      request_id: "req-cancel-1",
      action: "cancel",
      summary: "Cancel request req-old: duplicate of #123",
      created_at: "2026-09-11",
    });
  });

  it("does not load inbox files in production mode even if files are present", () => {
    vi.stubEnv("NODE_ENV", "production");

    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readdirSync").mockReturnValue([{ name: "01-test.json", isFile: () => true }] as unknown as ReturnType<
      typeof fs.readdirSync
    >);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({ id: "req-1", action: "new", payload: { summary: "Test" } }),
    );

    const snapshot = loadLedgerSnapshot();

    expect(snapshot.counts.pending).toBe(0);
    expect(snapshot.pending).toEqual([]);
  });

  it("gracefully falls back when the inbox directory does not exist", () => {
    vi.stubEnv("NODE_ENV", "development");

    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    const snapshot = loadLedgerSnapshot();

    expect(snapshot.counts.pending).toBe(0);
    expect(snapshot.pending).toEqual([]);
  });

  it("gracefully falls back if reading inbox directory throws an error", () => {
    vi.stubEnv("NODE_ENV", "development");

    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readdirSync").mockImplementation((() => {
      throw new Error("EACCES: permission denied");
    }) as unknown as typeof fs.readdirSync);

    const snapshot = loadLedgerSnapshot();

    expect(snapshot.counts.pending).toBe(0);
    expect(snapshot.pending).toEqual([]);
  });

  it("populates pending requests using custom inbox directory with real files", () => {
    vi.stubEnv("NODE_ENV", "development");
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "inbox-test-"));
    try {
      fs.writeFileSync(
        path.join(tempDir, "sample.json"),
        JSON.stringify({
          id: "req-temp-1",
          action: "done",
          createdOn: "2026-09-12",
          payload: { id: "#456", outcome: "Resolved in PR #123" },
        }),
      );

      const snapshot = loadLedgerSnapshot({ inboxDir: tempDir });
      expect(snapshot.counts.pending).toBe(1);
      expect(snapshot.pending).toEqual([
        {
          request_id: "req-temp-1",
          action: "done",
          summary: "#456: Resolved in PR #123",
          created_at: "2026-09-12",
        },
      ]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("formats update, cancel, and fallback requests matching snapshot generator logic", () => {
    expect(
      formatInboxRecord({
        id: "u1",
        action: "update",
        payload: { id: "#1", summary: "", detail: "", source: "" },
      }).summary,
    ).toBe("#1: summary → (clear); detail → (clear); source → (clear)");

    expect(
      formatInboxRecord({
        id: "u2",
        action: "update",
        payload: { id: "#2" },
      }).summary,
    ).toBe("#2: (no change in the update request)");

    expect(
      formatInboxRecord({
        id: "c1",
        action: "cancel",
        payload: {},
      }).summary,
    ).toBe("Cancel request: (no reason in the cancel request)");

    expect(
      formatInboxRecord({
        id: "o1",
        action: "custom",
        payload: {},
      }).summary,
    ).toBe("(no summary in the custom request)");
  });
});
