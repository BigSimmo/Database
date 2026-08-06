import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
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
  execFileSync("git", ["commit", "--allow-empty", "-qm", "init"], { cwd: root });
  const gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  return { root, gitDir };
}

function runHook(
  mode: "post" | "pre",
  payload: Record<string, unknown>,
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
  const result = spawnSync("bash", [hook, mode], {
    cwd,
    input: JSON.stringify(payload),
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

  it("sanitizes unsafe session ids before building the marker path", () => {
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
    expect(out.markerExists("unknown-session")).toBe(true);
    expect(existsSync(join(gitDir, "..", "claude-pr-handoff-evil"))).toBe(false);
  });

  it("keeps the current session marker when pruning day-old siblings", () => {
    const { root, gitDir } = freshRepo();
    const current = join(gitDir, "claude-pr-handoff-sess-keep");
    const other = join(gitDir, "claude-pr-handoff-other");
    execFileSync("bash", ["-lc", `printf 'old\\n' >"$1" && printf 'old\\n' >"$2"`, "_", current, other]);
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
    expect(existsSync(other)).toBe(false);
  });

  it("denies quoted compound follow commands when jq is unavailable", () => {
    const { root, gitDir } = freshRepo();
    const marker = join(gitDir, "claude-pr-handoff-sess-quoted");
    execFileSync("bash", ["-lc", `printf 'pr-opened\\n' >"$1"`, "_", marker]);

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
});
