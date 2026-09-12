import { describe, expect, it } from "vitest";

import { applyRequest, applyRequestBatch, planRequestBatch } from "../scripts/ledger-inbox.mjs";
import { mergeArchiveOutcome, pruneResolvedIdFromQueue, resolveIssue } from "../scripts/outstanding-issues.mjs";
import { checkIssues, parseIssues, issueRowFingerprint } from "../scripts/check-outstanding-issues.mjs";

const BASE_LEDGER = [
  "<!-- issues:next-id=10 -->",
  "",
  "## Recommended execution queue",
  "",
  "<!-- prettier-ignore -->",
  "",
  "| Order | ID(s) | Acuity | Capability | When | Estimate | Outcome |",
  "| ----: | -------------- | -------- | --- | --- | --- | --- |",
  "| 1 | `#001` | A2 | High | now | 1h | solo |",
  "| 2 | `#DREDWA` | A2 | Med | later | 2h | crockford |",
  "",
  "## Open items",
  "",
  "<!-- prettier-ignore -->",
  "",
  "| ID | Pri | Type | Summary | Detail / next action | Source | Added |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  "| #001 | P2 | issue | First open issue | detail one | src | 2026-01-01 |",
  "| #002 | P3 | task | Second open task | detail two | src | 2026-01-02 |",
  "| #DREDWA <!-- issue-ulid:01M09A9WXBDREDWA7KN2EB1JRA --> | P2 | task | Crockford issue | detail crockford | src | 2026-01-03 |",
  "",
  "## Resolved / archive",
  "",
  "<!-- prettier-ignore -->",
  "",
  "| ID | Type | Summary | Outcome | Resolved |",
  "| ---- | ---- | ---- | ---- | ---- |",
  "| #000 | task | Initial task | Closed in bootstrap | 2025-12-01 |",
  "| #005 | issue | Prior resolved issue | Original outcome text from PR #10 | 2026-01-01 |",
  "",
].join("\n");

describe("ledger-inbox idempotent close and duplicate done handling", () => {
  describe("idempotent close of already-archived issues", () => {
    it("preserves existing outcome and merges new outcome note when applying done request to archived issue", () => {
      const doneRequest = {
        version: 1,
        id: "11111111-1111-4111-8111-111111111111",
        createdOn: "2026-08-15",
        action: "done",
        payload: {
          id: "#005",
          outcome: "Verified fix in PR #20",
        },
      };

      const result = applyRequest(BASE_LEDGER, doneRequest, { allowArchived: true });

      // Verify valid ledger structure
      const problems = checkIssues(result, { prettierIgnored: true });
      expect(problems).toEqual([]);

      const parsed = parseIssues(result);
      const row = parsed.rows.find((r) => r.id === "#005");
      expect(row).toBeDefined();
      expect(row?.table).toBe("archive");
      expect(row?.raw).toContain("Original outcome text from PR #10 \\| Note: Verified fix in PR #20");
    });

    it("handles done request with baseRowFingerprint when issue was already archived", () => {
      // Even if a client queued a done request with a baseRowFingerprint before the issue got archived
      const doneRequest = {
        version: 1,
        id: "22222222-2222-4222-8222-222222222222",
        createdOn: "2026-08-15",
        action: "done",
        payload: {
          id: "#005",
          outcome: "Follow-up notes from PR #30",
          baseRowFingerprint: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        },
      };

      const result = applyRequest(BASE_LEDGER, doneRequest);
      expect(checkIssues(result, { prettierIgnored: true })).toEqual([]);

      const parsed = parseIssues(result);
      const row = parsed.rows.find((r) => r.id === "#005");
      expect(row?.raw).toContain("Original outcome text from PR #10 \\| Note: Follow-up notes from PR #30");
    });

    it("is idempotent and does not repeatedly append duplicate outcome notes", () => {
      const doneRequest = {
        version: 1,
        id: "33333333-3333-4333-8333-333333333333",
        createdOn: "2026-08-15",
        action: "done",
        payload: {
          id: "#005",
          outcome: "Verified fix in PR #20",
        },
      };

      const once = applyRequest(BASE_LEDGER, doneRequest, { allowArchived: true });
      const twice = applyRequest(once, doneRequest, { allowArchived: true });

      const parsedOnce = parseIssues(once);
      const parsedTwice = parseIssues(twice);
      const rowOnce = parsedOnce.rows.find((r) => r.id === "#005");
      const rowTwice = parsedTwice.rows.find((r) => r.id === "#005");

      expect(rowOnce?.raw).toBe(rowTwice?.raw);
      expect(rowTwice?.raw).toContain("Original outcome text from PR #10 \\| Note: Verified fix in PR #20");
    });

    it("resolveIssue allows idempotent close when allowArchived option is set", () => {
      const updated = resolveIssue(BASE_LEDGER, "#005", "Direct resolve note", { allowArchived: true });
      const parsed = parseIssues(updated);
      const row = parsed.rows.find((r) => r.id === "#005");
      expect(row?.raw).toContain("Original outcome text from PR #10 \\| Note: Direct resolve note");

      const updatedWithIdempotent = resolveIssue(BASE_LEDGER, "#005", "Direct idempotent note", {
        idempotent: true,
      });
      expect(updatedWithIdempotent).toBe(BASE_LEDGER);
    });

    it("resolveIssue throws already archived error when allowArchived option is not set", () => {
      expect(() => resolveIssue(BASE_LEDGER, "#005", "Should fail")).toThrow(/already archived/);
    });

    it("mergeArchiveOutcome helper formats and merges notes correctly", () => {
      expect(mergeArchiveOutcome("PR #1", "PR #2")).toBe("PR #1 \\| Note: PR #2");
      expect(mergeArchiveOutcome("PR #1", "Note: PR #2")).toBe("PR #1 \\| Note: PR #2");
      expect(mergeArchiveOutcome("PR #1 \\| Note: PR #2", "PR #2")).toBe("PR #1 \\| Note: PR #2");
      expect(mergeArchiveOutcome("PR #1 \\| Note: PR #2", "PR #3")).toBe("PR #1 \\| Note: PR #2 \\| Note: PR #3");
      expect(mergeArchiveOutcome("", "PR #1")).toBe("PR #1");
    });
  });

  describe("archived done with createRequest allowArchived reaches merge path", () => {
    it("applyRequestBatch merges outcome when payload.allowArchived is set (createRequest path)", () => {
      const doneRequest = {
        version: 1,
        id: "eeee1111-1111-4111-8111-111111111111",
        createdOn: "2026-08-15",
        action: "done",
        payload: {
          id: "#005",
          outcome: "Landed after prior reconciliation archived the row",
          // Mirrors createRequest marking archive-aware closes so reconcile
          // does not silently no-op via the idempotent archived fast-path.
          allowArchived: true,
        },
      };

      const result = applyRequestBatch(BASE_LEDGER, [doneRequest]);
      expect(checkIssues(result.markdown, { prettierIgnored: true })).toEqual([]);

      const parsed = parseIssues(result.markdown);
      const row = parsed.rows.find((r) => r.id === "#005");
      expect(row?.table).toBe("archive");
      expect(row?.raw).toContain(
        "Original outcome text from PR #10 \\| Note: Landed after prior reconciliation archived the row",
      );
    });

    it("applyRequestBatch no-ops archived done without allowArchived (integrity)", () => {
      const staleDone = {
        version: 1,
        id: "eeee3333-3333-4333-8333-333333333333",
        createdOn: "2026-08-15",
        action: "done",
        payload: {
          id: "#005",
          outcome: "Should not merge without allowArchived",
        },
      };
      expect(applyRequestBatch(BASE_LEDGER, [staleDone]).markdown).toBe(BASE_LEDGER);
    });

    it("applyRequest with idempotent merges archived done when payload.allowArchived is set", () => {
      const doneRequest = {
        version: 1,
        id: "eeee2222-2222-4222-8222-222222222222",
        createdOn: "2026-08-15",
        action: "done",
        payload: {
          id: "#005",
          outcome: "Archive-aware queued close",
          allowArchived: true,
        },
      };
      const result = applyRequest(BASE_LEDGER, doneRequest, { idempotent: true });
      expect(result).toContain("Original outcome text from PR #10 \\| Note: Archive-aware queued close");
    });
  });

  describe("lowercase Crockford locator queue pruning", () => {
    it("resolveIssue with lowercase display id archives and prunes uppercase queue citation", () => {
      const updated = resolveIssue(BASE_LEDGER, "#dredwa", "Closed via lowercase locator");
      expect(checkIssues(updated, { prettierIgnored: true })).toEqual([]);
      expect(updated).not.toContain("`#DREDWA`");
      expect(updated).not.toContain("`#dredwa`");
      const parsed = parseIssues(updated);
      const row = parsed.rows.find((r) => r.id === "#DREDWA");
      expect(row?.table).toBe("archive");
      expect(row?.raw).toContain("Closed via lowercase locator");
    });

    it("pruneResolvedIdFromQueue normalizes lowercase target against uppercase citations", () => {
      const pruned = pruneResolvedIdFromQueue(BASE_LEDGER, "#dredwa");
      expect(pruned).not.toContain("`#DREDWA`");
      expect(pruned).toContain("`#001`");
    });
  });

  describe("concurrent duplicate done requests in a batch", () => {
    it("planRequestBatch does not flag duplicate done requests as mutation conflicts", () => {
      const req1 = {
        version: 1,
        id: "aaaa1111-1111-4111-8111-111111111111",
        createdOn: "2026-08-15",
        action: "done",
        payload: { id: "#001", outcome: "Resolved in PR #101" },
      };
      const req2 = {
        version: 1,
        id: "aaaa2222-2222-4222-8222-222222222222",
        createdOn: "2026-08-15",
        action: "done",
        payload: { id: "#001", outcome: "Resolved in PR #102" },
      };

      const plan = planRequestBatch([req1, req2]);
      expect(plan.active).toHaveLength(2);
      expect(plan.cancellations).toHaveLength(0);
    });

    it("applyRequestBatch merges outcome notes cleanly for duplicate done requests", () => {
      const req1 = {
        version: 1,
        id: "bbbb1111-1111-4111-8111-111111111111",
        createdOn: "2026-08-15",
        action: "done",
        payload: {
          id: "#001",
          outcome: "Closed in branch A",
          baseRowFingerprint: issueRowFingerprint(BASE_LEDGER, "#001"),
        },
      };
      const req2 = {
        version: 1,
        id: "bbbb2222-2222-4222-8222-222222222222",
        createdOn: "2026-08-15",
        action: "done",
        payload: {
          id: "#001",
          outcome: "Closed in branch B",
          baseRowFingerprint: issueRowFingerprint(BASE_LEDGER, "#001"),
        },
      };

      const result = applyRequestBatch(BASE_LEDGER, [req1, req2]);
      expect(checkIssues(result.markdown, { prettierIgnored: true })).toEqual([]);

      const parsed = parseIssues(result.markdown);
      const row = parsed.rows.find((r) => r.id === "#001");
      expect(row).toBeDefined();
      expect(row?.table).toBe("archive");
      expect(row?.raw).toContain("Closed in branch A \\| Note: Closed in branch B");

      // Verify #001 was dropped from recommended execution queue
      expect(result.markdown).not.toContain("`#001`");
    });

    it("merges three duplicate done requests in a batch", () => {
      const req1 = {
        version: 1,
        id: "cccc1111-1111-4111-8111-111111111111",
        createdOn: "2026-08-15",
        action: "done",
        payload: { id: "#001", outcome: "Close step 1" },
      };
      const req2 = {
        version: 1,
        id: "cccc2222-2222-4222-8222-222222222222",
        createdOn: "2026-08-15",
        action: "done",
        payload: { id: "#001", outcome: "Close step 2" },
      };
      const req3 = {
        version: 1,
        id: "cccc3333-3333-4333-8333-333333333333",
        createdOn: "2026-08-15",
        action: "done",
        payload: { id: "#001", outcome: "Close step 3" },
      };

      const result = applyRequestBatch(BASE_LEDGER, [req1, req2, req3]);
      expect(checkIssues(result.markdown, { prettierIgnored: true })).toEqual([]);

      const parsed = parseIssues(result.markdown);
      const row = parsed.rows.find((r) => r.id === "#001");
      expect(row?.raw).toContain("Close step 1 \\| Note: Close step 2 \\| Note: Close step 3");
    });

    it("merges duplicate done requests for Crockford ULID display IDs", () => {
      const req1 = {
        version: 1,
        id: "dddd1111-1111-4111-8111-111111111111",
        createdOn: "2026-08-15",
        action: "done",
        payload: {
          id: "#DREDWA",
          outcome: "Crockford close 1",
          baseRowFingerprint: issueRowFingerprint(BASE_LEDGER, "#DREDWA"),
        },
      };
      const req2 = {
        version: 1,
        id: "dddd2222-2222-4222-8222-222222222222",
        createdOn: "2026-08-15",
        action: "done",
        payload: {
          id: "#DREDWA",
          outcome: "Crockford close 2",
          baseRowFingerprint: issueRowFingerprint(BASE_LEDGER, "#DREDWA"),
        },
      };

      const result = applyRequestBatch(BASE_LEDGER, [req1, req2]);
      expect(checkIssues(result.markdown, { prettierIgnored: true })).toEqual([]);

      const parsed = parseIssues(result.markdown);
      const row = parsed.rows.find((r) => r.id === "#DREDWA");
      expect(row).toBeDefined();
      expect(row?.table).toBe("archive");
      expect(row?.ulid).toBe("01M09A9WXBDREDWA7KN2EB1JRA");
      expect(row?.raw).toContain("Crockford close 1 \\| Note: Crockford close 2");
      expect(result.markdown).not.toContain("`#DREDWA`");
    });

    it("applies duplicate done requests alongside other distinct actions", () => {
      const addReq = {
        version: 1,
        id: "eeee1111-1111-4111-8111-111111111111",
        createdOn: "2026-08-15",
        action: "add",
        payload: { pri: "P2", type: "task", summary: "New feature task" },
      };
      const doneReq1 = {
        version: 1,
        id: "eeee2222-2222-4222-8222-222222222222",
        createdOn: "2026-08-15",
        action: "done",
        payload: { id: "#001", outcome: "Closed #001 first" },
      };
      const doneReq2 = {
        version: 1,
        id: "eeee3333-3333-4333-8333-333333333333",
        createdOn: "2026-08-15",
        action: "done",
        payload: { id: "#001", outcome: "Closed #001 second" },
      };
      const doneOther = {
        version: 1,
        id: "eeee4444-4444-4444-8444-444444444444",
        createdOn: "2026-08-15",
        action: "done",
        payload: { id: "#002", outcome: "Closed #002" },
      };

      const result = applyRequestBatch(BASE_LEDGER, [addReq, doneReq1, doneReq2, doneOther]);
      expect(checkIssues(result.markdown, { prettierIgnored: true })).toEqual([]);

      const parsed = parseIssues(result.markdown);
      expect(parsed.rows.some((r) => r.table === "open" && r.raw.includes("New feature task"))).toBe(true);

      const row1 = parsed.rows.find((r) => r.id === "#001");
      expect(row1?.table).toBe("archive");
      expect(row1?.raw).toContain("Closed #001 first \\| Note: Closed #001 second");

      const row2 = parsed.rows.find((r) => r.id === "#002");
      expect(row2?.table).toBe("archive");
      expect(row2?.raw).toContain("Closed #002");
    });

    it("still rejects colliding mutations between done and update for the same issue", () => {
      const doneReq = {
        version: 1,
        id: "ffff1111-1111-4111-8111-111111111111",
        createdOn: "2026-08-15",
        action: "done",
        payload: { id: "#001", outcome: "done #001" },
      };
      const updateReq = {
        version: 1,
        id: "ffff2222-2222-4222-8222-222222222222",
        createdOn: "2026-08-15",
        action: "update",
        payload: { id: "#001", summary: "new summary" },
      };

      expect(() => applyRequestBatch(BASE_LEDGER, [doneReq, updateReq])).toThrow(
        /multiple pending mutations require an explicit cancellation decision/,
      );
    });

    it("still rejects colliding mutations between done and queue for the same issue", () => {
      const doneReq = {
        version: 1,
        id: "ffff3333-3333-4333-8333-333333333333",
        createdOn: "2026-08-15",
        action: "done",
        payload: { id: "#001", outcome: "done #001" },
      };
      const queueReq = {
        version: 1,
        id: "ffff4444-4444-4444-8444-444444444444",
        createdOn: "2026-08-15",
        action: "queue",
        payload: { id: "#001", acuity: "A1" },
      };

      expect(() => applyRequestBatch(BASE_LEDGER, [doneReq, queueReq])).toThrow(
        /multiple pending mutations require an explicit cancellation decision/,
      );
    });
  });
});
