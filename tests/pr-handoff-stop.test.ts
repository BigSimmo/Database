import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const hook = join(process.cwd(), ".claude/hooks/pr-handoff-stop.sh");
const scratchRoots: string[] = [];

/** Default budget is 30 minutes; these ages sit unambiguously either side of it. */
const INSIDE_BUDGET_SECONDS = 60;
const PAST_BUDGET_SECONDS = 31 * 60;

afterEach(() => {
  for (const root of scratchRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

function freshRepo(): { root: string; gitDir: string } {
  const root = mkdtempSync(join(tmpdir(), "pr-handoff-"));
  scratchRoots.push(root);
  execFileSync("git", ["init", "-q"], { cwd: root });
  // No empty commit: git rev-parse --absolute-git-dir works without user.identity.
  const gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  return { root, gitDir };
}

/**
 * A marker as post-mode writes it, aged by `ageSeconds`. The budget is measured from the
 * `epoch=` stamp in the contents, never from mtime, so age is set by the stamp alone.
 */
function writeMarker(gitDir: string, sessionId: string, ageSeconds: number): string {
  const path = join(gitDir, `claude-pr-handoff-${sessionId}`);
  const epoch = Math.floor(Date.now() / 1000) - ageSeconds;
  writeFileSync(path, `pr-opened 2026-08-19T00:00:00Z epoch=${epoch}\n`);
  return path;
}

function runHook(
  mode: "post" | "pre",
  payload: Record<string, unknown> | string,
  cwd: string,
  options?: { pathWithoutJq?: boolean; env?: Record<string, string> },
): { status: number | null; stdout: string; markerExists: (sessionId: string) => boolean; gitDir: string } {
  const gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], {
    cwd,
    encoding: "utf8",
  }).trim();
  const env = { ...process.env, ...(options?.env ?? {}) };
  if (options?.pathWithoutJq) {
    // Keep a minimal PATH that can run the hook's shell utilities but cannot
    // resolve jq, so the quote-naive fallback path is exercised.
    const bin = mkdtempSync(join(tmpdir(), "no-jq-path-"));
    scratchRoots.push(bin);
    for (const name of ["bash", "cat", "grep", "sed", "tr", "date", "find", "touch", "head", "git"]) {
      const resolved = execFileSync("bash", ["-lc", `command -v ${name}`], {
        encoding: "utf8",
      }).trim();
      execFileSync("ln", ["-s", resolved, join(bin, name)]);
    }
    env.PATH = bin;
  }
  const input = typeof payload === "string" ? payload : JSON.stringify(payload);
  const result = spawnSync("bash", [hook, mode], {
    cwd,
    input,
    encoding: "utf8",
    env,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    gitDir,
    markerExists: (sessionId: string) => existsSync(join(gitDir, `claude-pr-handoff-${sessionId}`)),
  };
}

// The hook is a Bash contract exercised on Linux CI. Windows' `bash.exe` is a
// WSL launcher: it cannot execute the native absolute paths this fixture gives
// it and can retain NTFS directory handles after exit. That is neither the
// hook's runtime nor meaningful Windows coverage, so avoid false local reds.
describe.skipIf(process.platform === "win32")("pr-babysit budget hook", () => {
  describe("post — starting the budget", () => {
    it("does not treat create_pull_request_review as opening a PR", () => {
      const { root } = freshRepo();
      const out = runHook(
        "post",
        {
          tool_name: "create_pull_request_review",
          session_id: "sess-review",
          tool_response: "https://github.com/BigSimmo/Database/pull/1649#pullrequestreview-1",
        },
        root,
      );
      expect(out.status).toBe(0);
      expect(out.markerExists("sess-review")).toBe(false);
      expect(out.stdout).toBe("");
    });

    it("writes an epoch-stamped marker for create_pull_request when the response has a PR URL", () => {
      const { root, gitDir } = freshRepo();
      const out = runHook(
        "post",
        {
          tool_name: "create_pull_request",
          session_id: "sess-create",
          tool_response: "Opened https://github.com/BigSimmo/Database/pull/1649",
        },
        root,
      );
      expect(out.status).toBe(0);
      expect(out.markerExists("sess-create")).toBe(true);
      expect(out.stdout).toContain("PostToolUse");
      // Pre-mode measures the budget from this stamp. Without it every later call fails
      // open, so the ceiling would silently not exist.
      const stamp = /epoch=(\d+)/.exec(readFileSync(join(gitDir, "claude-pr-handoff-sess-create"), "utf8"));
      expect(stamp, "marker must carry an epoch= stamp").not.toBeNull();
      expect(Math.abs(Number(stamp![1]) - Math.floor(Date.now() / 1000))).toBeLessThan(120);
    });

    it("tells the model babysitting is allowed, not that the session is over", () => {
      const { root } = freshRepo();
      const out = runHook(
        "post",
        {
          tool_name: "create_pull_request",
          session_id: "sess-context",
          tool_response: "Opened https://github.com/BigSimmo/Database/pull/1649",
        },
        root,
      );
      expect(out.stdout).toContain("babysit");
      expect(out.stdout).toContain("30 minutes");
    });

    it("fails open for unsafe session ids instead of sharing unknown-session", () => {
      const { root, gitDir } = freshRepo();
      const out = runHook(
        "post",
        {
          tool_name: "create_pull_request",
          session_id: "../evil",
          tool_response: "https://github.com/BigSimmo/Database/pull/1",
        },
        root,
      );
      expect(out.status).toBe(0);
      expect(out.markerExists("unknown-session")).toBe(false);
      expect(existsSync(join(gitDir, "..", "claude-pr-handoff-evil"))).toBe(false);
      expect(out.stdout).toBe("");
    });

    it("does not prune sibling session markers from post-mode Bash", () => {
      // Cross-session age-based prune would disarm a session still inside its own budget.
      const { root, gitDir } = freshRepo();
      const current = join(gitDir, "claude-pr-handoff-sess-keep");
      const other = join(gitDir, "claude-pr-handoff-other");
      writeFileSync(current, "old\n");
      writeFileSync(other, "old\n");
      const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;
      utimesSync(current, twoDaysAgo, twoDaysAgo);
      utimesSync(other, twoDaysAgo, twoDaysAgo);

      const out = runHook(
        "post",
        {
          tool_name: "Bash",
          session_id: "sess-keep",
          tool_input: { command: "true" },
          tool_response: "ok",
        },
        root,
      );
      expect(out.status).toBe(0);
      expect(existsSync(current)).toBe(true);
      expect(existsSync(other)).toBe(true);
    });

    it("emits handoff context only when the marker file exists", () => {
      const { root, gitDir } = freshRepo();
      // A directory at the exact marker path makes shell redirection fail for
      // root and non-root users. Post must fail open with no additionalContext
      // (the model must not be paced against a ceiling pre-mode never enforces).
      const marker = join(gitDir, "claude-pr-handoff-sess-readonly");
      mkdirSync(marker);

      const out = runHook(
        "post",
        {
          tool_name: "create_pull_request",
          session_id: "sess-readonly",
          tool_response: "Opened https://github.com/BigSimmo/Database/pull/1649",
        },
        root,
      );
      expect(out.status).toBe(0);
      expect(lstatSync(marker).isDirectory()).toBe(true);
      expect(out.stdout).toBe("");
    });

    it("still detects gh pr create after a quoted arg when jq is unavailable", () => {
      const { root } = freshRepo();
      const out = runHook(
        "post",
        {
          tool_name: "Bash",
          session_id: "sess-create-quoted",
          tool_input: { command: 'git commit -m "open pr" && gh pr create --fill' },
          tool_response: "https://github.com/BigSimmo/Database/pull/1649",
        },
        root,
        { pathWithoutJq: true },
      );
      expect(out.status).toBe(0);
      expect(out.markerExists("sess-create-quoted")).toBe(true);
      expect(out.stdout).toContain("PostToolUse");
    });

    it("does not lock from a printed gh pr create token in tool_response when jq is unavailable", () => {
      const { root } = freshRepo();
      const out = runHook(
        "post",
        {
          tool_name: "Bash",
          session_id: "sess-print-docs",
          tool_input: { command: "cat AGENTS.md" },
          tool_response:
            "Documented handoff: run gh pr create then open https://github.com/BigSimmo/Database/pull/1649",
        },
        root,
        { pathWithoutJq: true },
      );
      expect(out.status).toBe(0);
      expect(out.markerExists("sess-print-docs")).toBe(false);
      expect(out.stdout).toBe("");
    });

    it("ignores a tool_input URL after tool_response when jq is unavailable", () => {
      const { root } = freshRepo();
      // Key order matters for the jq-less suffix extractor: response first, then
      // an input field that happens to mention a PR URL must not write a marker.
      const payload =
        '{"tool_name":"Bash","session_id":"sess-order","tool_response":"create failed","tool_input":{"command":"gh pr create --fill","url":"https://github.com/BigSimmo/Database/pull/1649"}}';
      const out = runHook("post", payload, root, { pathWithoutJq: true });
      expect(out.status).toBe(0);
      expect(out.markerExists("sess-order")).toBe(false);
      expect(out.stdout).toBe("");
    });
  });

  describe("pre — inside the budget, following the PR is allowed", () => {
    it.each([
      ["gh pr checks", { tool_name: "Bash", tool_input: { command: "gh pr checks" } }],
      ["gh run view", { tool_name: "Bash", tool_input: { command: "gh run view 42 --log-failed" } }],
      ["gh pr comment", { tool_name: "Bash", tool_input: { command: "gh pr comment 1 --body ok" } }],
      ["sync:pr-branches", { tool_name: "Bash", tool_input: { command: "npm run sync:pr-branches" } }],
      ["a GitHub MCP PR tool", { tool_name: "mcp__github__get_pull_request" }],
      ["a workflow-run MCP tool", { tool_name: "mcp__github__list_workflow_run_jobs" }],
    ])("allows %s while the budget lasts", (_label, payload) => {
      const { root, gitDir } = freshRepo();
      writeMarker(gitDir, "sess-inside", INSIDE_BUDGET_SECONDS);
      const out = runHook("pre", { ...payload, session_id: "sess-inside" }, root);
      expect(out.status).toBe(0);
      expect(out.stdout).toBe("");
    });

    it.each(["ScheduleWakeup", "Monitor"])("allows %s, which is how the cadence floor is honoured", (tool_name) => {
      // Denying the wait does not stop the loop, it only converts a five-minute
      // cadence into tight polling. That is worse, so these pass inside the budget.
      const { root, gitDir } = freshRepo();
      writeMarker(gitDir, "sess-wait", INSIDE_BUDGET_SECONDS);
      const out = runHook("pre", { tool_name, session_id: "sess-wait" }, root);
      expect(out.status).toBe(0);
      expect(out.stdout).toBe("");
    });

    it("denies CronCreate even inside the budget", () => {
      // A cron entry outlives the session, so no later budget check could stop it.
      const { root, gitDir } = freshRepo();
      writeMarker(gitDir, "sess-cron", INSIDE_BUDGET_SECONDS);
      const out = runHook("pre", { tool_name: "CronCreate", session_id: "sess-cron" }, root);
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('"permissionDecision":"deny"');
      expect(out.stdout).toContain("outlives the session");
    });
  });

  describe("pre — past the budget, the follow tools are denied", () => {
    it.each([
      ["gh pr checks", { tool_name: "Bash", tool_input: { command: "gh pr checks" } }],
      ["gh pr comment", { tool_name: "Bash", tool_input: { command: "gh pr comment 1 --body ok" } }],
      ["gh pr review", { tool_name: "Bash", tool_input: { command: "gh pr review 1 --approve" } }],
      ["gh run watch", { tool_name: "Bash", tool_input: { command: "gh run watch" } }],
      ["a GitHub MCP PR tool", { tool_name: "mcp__github__get_pull_request" }],
      ["ScheduleWakeup", { tool_name: "ScheduleWakeup" }],
      ["Monitor", { tool_name: "Monitor" }],
    ])("denies %s once the budget is spent", (_label, payload) => {
      const { root, gitDir } = freshRepo();
      writeMarker(gitDir, "sess-spent", PAST_BUDGET_SECONDS);
      const out = runHook("pre", { ...payload, session_id: "sess-spent" }, root);
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('"permissionDecision":"deny"');
    });

    it.each([
      ["git push", "git push -u origin HEAD"],
      ["a ledger append", "npm run ledger:append -- --ref x"],
      ["gh pr merge", "gh pr merge --squash"],
    ])("still allows %s once the budget is spent", (_label, command) => {
      const { root, gitDir } = freshRepo();
      writeMarker(gitDir, "sess-allowed", PAST_BUDGET_SECONDS);
      const out = runHook("pre", { tool_name: "Bash", session_id: "sess-allowed", tool_input: { command } }, root);
      expect(out.status).toBe(0);
      expect(out.stdout).toBe("");
    });

    it("never denies a PR create or merge tool", () => {
      const { root, gitDir } = freshRepo();
      writeMarker(gitDir, "sess-write", PAST_BUDGET_SECONDS);
      for (const tool_name of ["create_pull_request", "merge_pull_request"]) {
        const out = runHook("pre", { tool_name, session_id: "sess-write" }, root);
        expect(out.status).toBe(0);
        expect(out.stdout).toBe("");
      }
    });

    it("denies quoted compound follow commands when jq is unavailable", () => {
      const { root, gitDir } = freshRepo();
      writeMarker(gitDir, "sess-quoted", PAST_BUDGET_SECONDS);

      const out = runHook(
        "pre",
        {
          tool_name: "Bash",
          session_id: "sess-quoted",
          // Escaped quotes inside the JSON command string truncate the jq-less
          // extractor at `git commit -m \`; follow matching must still see the
          // later `gh pr checks` token via the raw-payload fallback.
          tool_input: { command: 'git commit -m "msg" && gh pr checks' },
        },
        root,
        { pathWithoutJq: true },
      );
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('"permissionDecision":"deny"');
      expect(out.stdout).toContain("budget");
    });

    it("requires CLAUDE_ALLOW_PR_FOLLOW=1 as a command prefix", () => {
      const { root, gitDir } = freshRepo();
      writeMarker(gitDir, "sess-unlock", PAST_BUDGET_SECONDS);

      const denied = runHook(
        "pre",
        {
          tool_name: "Bash",
          session_id: "sess-unlock",
          tool_input: { command: "echo CLAUDE_ALLOW_PR_FOLLOW=1 && gh pr checks" },
        },
        root,
      );
      expect(denied.stdout).toContain('"permissionDecision":"deny"');

      const allowed = runHook(
        "pre",
        {
          tool_name: "Bash",
          session_id: "sess-unlock",
          tool_input: { command: "CLAUDE_ALLOW_PR_FOLLOW=1 gh pr checks" },
        },
        root,
      );
      expect(allowed.status).toBe(0);
      expect(allowed.stdout).toBe("");
    });
  });

  describe("pre — the budget itself", () => {
    it("honours CLAUDE_PR_BABYSIT_BUDGET_MINUTES", () => {
      const { root, gitDir } = freshRepo();
      writeMarker(gitDir, "sess-short", 90);
      const denied = runHook(
        "pre",
        { tool_name: "Bash", session_id: "sess-short", tool_input: { command: "gh pr checks" } },
        root,
        { env: { CLAUDE_PR_BABYSIT_BUDGET_MINUTES: "1" } },
      );
      expect(denied.stdout).toContain('"permissionDecision":"deny"');
      expect(denied.stdout).toContain("1-minute");

      const allowed = runHook(
        "pre",
        { tool_name: "Bash", session_id: "sess-short", tool_input: { command: "gh pr checks" } },
        root,
        { env: { CLAUDE_PR_BABYSIT_BUDGET_MINUTES: "120" } },
      );
      expect(allowed.stdout).toBe("");
    });

    it.each(["abc", "0", "9999", ""])(
      "falls back to the 30-minute default for the malformed budget %j",
      (CLAUDE_PR_BABYSIT_BUDGET_MINUTES) => {
        // A typo must neither remove the ceiling nor pin it to zero.
        const { root, gitDir } = freshRepo();
        writeMarker(gitDir, "sess-bad-budget", PAST_BUDGET_SECONDS);
        const out = runHook(
          "pre",
          { tool_name: "Bash", session_id: "sess-bad-budget", tool_input: { command: "gh pr checks" } },
          root,
          { env: { CLAUDE_PR_BABYSIT_BUDGET_MINUTES } },
        );
        expect(out.stdout).toContain("30-minute");

        writeMarker(gitDir, "sess-bad-budget", INSIDE_BUDGET_SECONDS);
        const inside = runHook(
          "pre",
          { tool_name: "Bash", session_id: "sess-bad-budget", tool_input: { command: "gh pr checks" } },
          root,
          { env: { CLAUDE_PR_BABYSIT_BUDGET_MINUTES } },
        );
        expect(inside.stdout).toBe("");
      },
    );

    it("fails open for a marker with no epoch stamp", () => {
      // Markers written before the budget existed must not deny a whole session.
      const { root, gitDir } = freshRepo();
      writeFileSync(join(gitDir, "claude-pr-handoff-sess-legacy"), "pr-opened 2026-08-06T00:00:00Z\n");
      const out = runHook(
        "pre",
        { tool_name: "Bash", session_id: "sess-legacy", tool_input: { command: "gh pr checks" } },
        root,
      );
      expect(out.status).toBe(0);
      expect(out.stdout).toBe("");
    });

    it("fails open when the stamp is in the future", () => {
      // A clock that moved backwards is not evidence the budget is spent.
      const { root, gitDir } = freshRepo();
      writeMarker(gitDir, "sess-future", -3600);
      const out = runHook(
        "pre",
        { tool_name: "Bash", session_id: "sess-future", tool_input: { command: "gh pr checks" } },
        root,
      );
      expect(out.status).toBe(0);
      expect(out.stdout).toBe("");
    });

    it("does nothing at all when no PR was ever opened", () => {
      const { root } = freshRepo();
      const out = runHook(
        "pre",
        { tool_name: "Bash", session_id: "sess-no-pr", tool_input: { command: "gh pr checks" } },
        root,
      );
      expect(out.status).toBe(0);
      expect(out.stdout).toBe("");
    });
  });
});
