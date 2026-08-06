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
): { status: number | null; stdout: string; markerExists: (sessionId: string) => boolean; gitDir: string } {
  const gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], {
    cwd,
    encoding: "utf8",
  }).trim();
  const result = spawnSync("bash", [hook, mode], {
    cwd,
    input: JSON.stringify(payload),
    encoding: "utf8",
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
});
