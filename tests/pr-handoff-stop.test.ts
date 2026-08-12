import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const hook = join(process.cwd(), ".claude/hooks/pr-handoff-stop.sh");
const scratchRoots: string[] = [];

afterEach(() => {
  for (const root of scratchRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
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

function runHook(
  mode: "post" | "pre",
  payload: Record<string, unknown> | string,
  cwd: string,
  options?: { pathWithoutJq?: boolean },
): { status: number | null; stdout: string; markerExists: (sessionId: string) => boolean; gitDir: string } {
  const gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], {
    cwd,
    encoding: "utf8",
  }).trim();
  const env = { ...process.env };
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

describe("pr-handoff-stop hook", () => {
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

  it("writes a marker for create_pull_request when the response has a PR URL", () => {
    const { root } = freshRepo();
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
    // Cross-session age-based prune would disarm a long-lived handoff session
    // that only uses Read/Edit after opening its PR (no pre-mode touch).
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

  it("denies gh pr comment and gh pr review after handoff", () => {
    const { root, gitDir } = freshRepo();
    writeFileSync(join(gitDir, "claude-pr-handoff-sess-bots"), "pr-opened\n");

    for (const command of ["gh pr comment 1 --body ok", "gh pr review 1 --approve"]) {
      const out = runHook(
        "pre",
        {
          tool_name: "Bash",
          session_id: "sess-bots",
          tool_input: { command },
        },
        root,
      );
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('"permissionDecision":"deny"');
    }
  });

  it("emits handoff context only when the marker file exists", () => {
    const { root, gitDir } = freshRepo();
    // A directory at the exact marker path makes shell redirection fail for
    // root and non-root users. Post must fail open with no additionalContext
    // (the model must not be told tools are denied when no marker file landed).
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

  it("denies quoted compound follow commands when jq is unavailable", () => {
    const { root, gitDir } = freshRepo();
    const marker = join(gitDir, "claude-pr-handoff-sess-quoted");
    writeFileSync(marker, "pr-opened\n");

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
    expect(out.stdout).toContain("following it");
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
        tool_response: "Documented handoff: run gh pr create then open https://github.com/BigSimmo/Database/pull/1649",
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

  it("requires CLAUDE_ALLOW_PR_FOLLOW=1 as a command prefix", () => {
    const { root, gitDir } = freshRepo();
    writeFileSync(join(gitDir, "claude-pr-handoff-sess-unlock"), "pr-opened\n");

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
