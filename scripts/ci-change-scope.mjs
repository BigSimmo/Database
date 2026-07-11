#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { classifyChangedFiles, fullRunSentinelFiles, parsePorcelainV1Z } from "./lib/ci-change-scope.mjs";

const zeroSha = /^0{40}$/;

const outputs = [
  "docs_only",
  "source_changed",
  "ui_changed",
  "db_changed",
  "container_changed",
  "rag_eval_changed",
  "workflow_changed",
  "build_changed",
];

function runGit(args, trim = true) {
  const output = execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return trim ? output.trim() : output;
}

function getArgValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function changedFilesFromStatus() {
  const raw = runGit(["status", "--porcelain=v1", "-z", "--untracked-files=all"], false);
  return parsePorcelainV1Z(raw);
}

function changedFilesFromRange(base, head) {
  if (!base || !head || zeroSha.test(base) || zeroSha.test(head)) return null;
  try {
    const raw = runGit(["diff", "--name-only", `${base}...${head}`]);
    return raw ? raw.split(/\r?\n/).filter(Boolean) : [];
  } catch {
    try {
      const raw = runGit(["diff", "--name-only", base, head]);
      return raw ? raw.split(/\r?\n/).filter(Boolean) : [];
    } catch {
      // Unreachable base (e.g. force-push). Fall through to the full-run
      // sentinel rather than failing the whole changes job.
      return null;
    }
  }
}

function changedFilesFromUpstream() {
  try {
    const upstream = runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
    const mergeBase = runGit(["merge-base", "HEAD", upstream]);
    const raw = runGit(["diff", "--name-only", `${mergeBase}...HEAD`]);
    return [...(raw ? raw.split(/\r?\n/).filter(Boolean) : []), ...changedFilesFromStatus()];
  } catch {
    return changedFilesFromStatus();
  }
}

function resolveChangedFiles(args) {
  const filesArg = getArgValue(args, "--files");
  if (filesArg)
    return filesArg
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const separator = args.indexOf("--");
  if (separator >= 0) return args.slice(separator + 1);

  const base = getArgValue(args, "--base") ?? process.env.BASE_SHA ?? "";
  const head = getArgValue(args, "--head") ?? process.env.HEAD_SHA ?? "";
  const ranged = changedFilesFromRange(base, head);
  if (ranged) return ranged;

  if (process.env.GITHUB_ACTIONS === "true") {
    // Manual and scheduled CI runs should exercise the full gate set.
    return fullRunSentinelFiles;
  }

  return changedFilesFromUpstream();
}

function writeOutputs(result) {
  for (const key of outputs) {
    console.log(`${key}=${result[key]}`);
  }
  console.log(`changed_files=${result.files.join(",")}`);

  if (!process.env.GITHUB_OUTPUT) return;
  const lines = [...outputs.map((key) => `${key}=${result[key]}`), `changed_files=${result.files.join(",")}`];
  appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
}

function assertScope(name, files, expected) {
  const result = classifyChangedFiles(files);
  for (const [key, value] of Object.entries(expected)) {
    if (result[key] !== value) {
      throw new Error(`${name}: expected ${key}=${value}, received ${result[key]} for ${files.join(", ")}`);
    }
  }
}

function selfTest() {
  assertScope("docs-only", ["docs/process-note.md"], {
    docs_only: true,
    source_changed: false,
    build_changed: false,
  });
  assertScope("ui", ["src/components/ClinicalDashboard.tsx", "tests/ui-smoke.spec.ts"], {
    docs_only: false,
    source_changed: true,
    ui_changed: true,
    build_changed: true,
  });
  assertScope("db", ["supabase/migrations/20260710000000_example.sql"], {
    db_changed: true,
    source_changed: true,
  });
  assertScope("rag", ["src/lib/retrieval-selection.ts", "scripts/fixtures/rag-retrieval-golden.json"], {
    rag_eval_changed: true,
    source_changed: true,
  });
  assertScope("answer route", ["src/app/api/answer/route.ts"], {
    rag_eval_changed: true,
    source_changed: true,
  });
  assertScope("search route", ["src/app/api/search/route.ts"], {
    rag_eval_changed: true,
    source_changed: true,
  });
  assertScope("workflow", [".github/workflows/ci.yml", "AGENTS.md"], {
    workflow_changed: true,
    docs_only: false,
  });
  assertScope("container", ["Dockerfile.worker", "worker/python/requirements.txt"], {
    container_changed: true,
    build_changed: true,
  });
  assertScope("client mode config", ["src/lib/app-modes.ts"], {
    source_changed: true,
    ui_changed: true,
    build_changed: true,
  });
  assertScope("scope workflow script", ["scripts/ci-change-scope.mjs"], {
    workflow_changed: true,
    source_changed: true,
  });
  assertScope("runtime config", [".env.example", ".nvmrc"], {
    source_changed: true,
    container_changed: true,
    build_changed: true,
  });
  assertScope("full-run sentinel", fullRunSentinelFiles, {
    docs_only: false,
    source_changed: true,
    ui_changed: true,
    db_changed: true,
    container_changed: true,
    rag_eval_changed: true,
    workflow_changed: true,
    build_changed: true,
  });
  const renamed = parsePorcelainV1Z("R  src/components/NewPanel.tsx\0docs/OldPanel.md\0");
  if (!renamed.includes("src/components/NewPanel.tsx") || !renamed.includes("docs/OldPanel.md")) {
    throw new Error("rename parser must preserve both old and new paths");
  }
  console.log("CI change scope self-test passed.");
}

const args = process.argv.slice(2);
if (args.includes("--self-test")) {
  selfTest();
  process.exit(0);
}

const result = classifyChangedFiles(resolveChangedFiles(args));
if (args.includes("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else {
  writeOutputs(result);
}
