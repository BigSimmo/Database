import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
const bash =
  process.platform === "win32" ? path.join(process.env.ProgramFiles || "C:/Program Files", "Git/bin/bash.exe") : "bash";
const script = path.resolve("scripts/run-codex-cloud-github.sh");
const secret = "synthetic-lifecycle-test-secret";
const bashPath = (value: string) =>
  value.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function fixture(
  options: {
    mode?: string;
    profile?: string;
    secret?: boolean;
    cached?: boolean;
    authFailure?: boolean;
    loginFailure?: boolean;
    lifecycleFailure?: boolean;
    gateFailure?: boolean;
    nodeMissing?: boolean;
  } = {},
) {
  const root = mkdtempSync(path.join(os.tmpdir(), "cloud-github-lifecycle-"));
  roots.push(root);
  mkdirSync(path.join(root, "bin"));
  mkdirSync(path.join(root, "scripts"));
  const executable = (file: string, lines: string[]) => {
    const target = path.join(root, file);
    writeFileSync(target, ["#!/usr/bin/env bash", "set -eu", ...lines, ""].join("\n"));
    chmodSync(target, 0o755);
  };
  executable("bin/git", ['printf "%s\\n" "$FIXTURE_ROOT"']);
  executable("bin/gh", [
    'if [[ "$*" == "auth login"* ]]; then',
    '  received="$(cat)"',
    '  [[ "$received" == "$EXPECTED_SECRET" ]]',
    '  printf "%s\\n" "$received" >&2',
    '  [[ "$LOGIN_FAILURE" != 1 ]] || exit 1',
    '  printf "login\\n" >> "$FIXTURE_ROOT/events"',
    '  touch "$FIXTURE_ROOT/authenticated"',
    "else",
    '  printf "helper\\n" >> "$FIXTURE_ROOT/events"',
    "fi",
  ]);
  executable("bin/node", [
    'case "$1" in',
    '  --version) [[ "$NODE_MISSING" != 1 || -f "$FIXTURE_ROOT/node-restored" ]] ;;',
    '  *ensure-codex-cloud-git-remote.mjs) printf "origin\\n" >> "$FIXTURE_ROOT/events" ;;',
    "  *check-github-shell-access.mjs)",
    '    printf "auth-preflight\\n" >> "$FIXTURE_ROOT/events"',
    '    [[ -f "$FIXTURE_ROOT/authenticated" && "$AUTH_FAILURE" != 1 ]] || exit 1',
    '    [[ -z "${CODEX_CLOUD_GITHUB_PAT+x}" && -z "${GH_TOKEN+x}" && -z "${GITHUB_TOKEN+x}" ]] ;;',
    "  *) exit 90 ;;",
    "esac",
  ]);
  mkdirSync(path.join(root, ".nvm"));
  writeFileSync(path.join(root, ".node-version"), "24\n");
  executable(".nvm/nvm.sh", [
    "nvm() {",
    '  [[ "$*" == "install 24" && -z "${CODEX_CLOUD_GITHUB_PAT+x}" ]] || return 1',
    '  printf "node-restore\\n" >> "$FIXTURE_ROOT/events"',
    '  touch "$FIXTURE_ROOT/node-restored"',
    "}",
  ]);
  for (const name of ["setup", "maintain"]) {
    executable(`scripts/${name}-codex-cloud.sh`, [
      '[[ -z "${CODEX_CLOUD_GITHUB_PAT+x}" && -z "${GH_TOKEN+x}" && -z "${GITHUB_TOKEN+x}" ]]',
      '[[ -z "${npm_config_http_proxy+x}" && "$RAG_PROVIDER_MODE" == offline ]]',
      `printf "${name}\\n" >> "$FIXTURE_ROOT/events"`,
      '[[ "$LIFECYCLE_FAILURE" != 1 ]]',
    ]);
  }
  executable("scripts/install-codex-cloud-command-shims.sh", ['printf "shims\\n" >> "$FIXTURE_ROOT/events"']);
  executable("bin/npm", [
    '[[ "$*" == "run check:github-shell-access:live" ]]',
    'printf "live-gate\\n" >> "$FIXTURE_ROOT/events"',
    '[[ "$GATE_FAILURE" != 1 ]]',
  ]);
  if (options.cached) writeFileSync(path.join(root, "authenticated"), "");
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: bashPath(root),
    NVM_DIR: bashPath(path.join(root, ".nvm")),
    FIXTURE_ROOT: bashPath(root),
    EXPECTED_SECRET: secret,
    PATH: `${bashPath(path.join(root, "bin"))}:/usr/bin:/bin`,
    CODEX_CLOUD: "1",
    CODEX_CLOUD_ACCESS_PROFILE: options.profile ?? "connected",
    RAG_PROVIDER_MODE: "offline",
    GH_TOKEN: "synthetic-shadow-token",
    GITHUB_TOKEN: "synthetic-shadow-token",
    npm_config_http_proxy: "synthetic-obsolete-proxy",
    AUTH_FAILURE: options.authFailure ? "1" : "0",
    LOGIN_FAILURE: options.loginFailure ? "1" : "0",
    LIFECYCLE_FAILURE: options.lifecycleFailure ? "1" : "0",
    GATE_FAILURE: options.gateFailure ? "1" : "0",
    NODE_MISSING: options.nodeMissing ? "1" : "0",
  };
  delete environment.CODEX_CLOUD_GITHUB_PAT;
  if (options.secret) environment.CODEX_CLOUD_GITHUB_PAT = secret;
  // Git for Windows prepends its real Git to PATH while starting bash.exe.
  // Reset the fixture PATH inside the shell so no mocked call reaches a real service.
  const result = spawnSync(
    bash,
    [
      "-c",
      'export PATH="$FIXTURE_ROOT/bin:/usr/bin:/bin"; exec bash -x "$1" "$2"',
      "fixture",
      bashPath(script),
      options.mode ?? "setup",
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: environment,
      timeout: 15_000,
      windowsHide: true,
    },
  );
  const events = (() => {
    try {
      return readFileSync(path.join(root, "events"), "utf8").trim().split("\n");
    } catch {
      return [];
    }
  })();
  expect(result.error).toBeUndefined();
  expect(result.stdout + result.stderr).not.toContain(secret);
  return { ...result, events };
}

describe("authorized Cloud GitHub lifecycle", () => {
  it("authenticates before setup and removes secrets before child commands, even with caller tracing", () => {
    const result = fixture({ secret: true });
    expect(result.status, result.stderr).toBe(0);
    expect(result.events).toEqual(["login", "origin", "auth-preflight", "setup", "shims", "helper", "live-gate"]);
  });

  it("reuses cached authentication during maintenance without a setup secret", () => {
    const result = fixture({ mode: "maintenance", cached: true });
    expect(result.status, result.stderr).toBe(0);
    expect(result.events).toEqual(["origin", "auth-preflight", "maintain", "shims", "helper", "live-gate"]);
  });

  it.each([{ cached: false }, { cached: true, authFailure: true }])(
    "rejects missing or insufficient cached credentials before dependency work: %j",
    (options) => {
      const result = fixture({ mode: "maintenance", ...options });
      expect(result.status).not.toBe(0);
      expect(result.events).toEqual(["origin", "auth-preflight"]);
    },
  );

  it("fails closed on rejected login without printing the login output", () => {
    const result = fixture({ secret: true, loginFailure: true });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("GH_LOGIN_FAILED");
    expect(result.events).toEqual([]);
  });

  it("requires the connected profile before touching credentials", () => {
    const result = fixture({ profile: "offline", secret: true });
    expect(result.status).not.toBe(0);
    expect(result.events).toEqual([]);
  });

  it("does not admit the task when lifecycle repair fails", () => {
    const result = fixture({ cached: true, lifecycleFailure: true });
    expect(result.status).not.toBe(0);
    expect(result.events).toEqual(["origin", "auth-preflight", "setup"]);
  });

  it("propagates a failed final GitHub capability gate", () => {
    const result = fixture({ cached: true, gateFailure: true });
    expect(result.status).not.toBe(0);
    expect(result.events.at(-1)).toBe("live-gate");
  });

  it("restores missing Node before the authentication preflight and maintenance", () => {
    const result = fixture({ mode: "maintenance", cached: true, nodeMissing: true });
    expect(result.status, result.stderr).toBe(0);
    expect(result.events).toEqual([
      "node-restore",
      "origin",
      "auth-preflight",
      "maintain",
      "shims",
      "helper",
      "live-gate",
    ]);
  });
});
