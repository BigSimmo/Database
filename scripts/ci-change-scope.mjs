#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const zeroSha = /^0{40}$/;

const fullRunSentinelFiles = [
  "src/app/api/answer/__ci_full_run__.ts",
  "supabase/__ci_full_run__.sql",
  "Dockerfile",
  ".github/workflows/codex-autofix-review-comments.yml",
  // Ensures an unresolvable-base / scheduled full run also trips lockfile_changed
  // so the dependency audit runs in its blocking mode, not advisory.
  "package-lock.json",
];

const outputs = [
  "docs_only",
  "source_changed",
  "coverage_changed",
  "ui_changed",
  "db_changed",
  "container_changed",
  "rag_eval_changed",
  "workflow_changed",
  "codex_autofix_changed",
  "build_changed",
  "lockfile_changed",
];

function normalizePath(filePath) {
  return filePath
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/^github\//, ".github/");
}

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function runGitRaw(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function getArgValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function pathMatches(filePath, patterns) {
  return patterns.some((pattern) => {
    if (typeof pattern === "string") return filePath === pattern || filePath.startsWith(`${pattern}/`);
    return pattern.test(filePath);
  });
}

const docPatterns = [
  "docs",
  "mockups",
  /^.*\.md$/,
  /^.*\.mdx$/,
  /^README(?:\..*)?$/i,
  /^CHANGELOG(?:\..*)?$/i,
  /^LICENSE(?:\..*)?$/i,
];

const workflowPatterns = [
  ".github/workflows",
  ".github/actions",
  ".github/pull_request_template.md",
  "AGENTS.md",
  "docs/codex-review-protocol.md",
  "docs/process-hardening.md",
  /^scripts\/(?:ci-change-scope|verify-pr-local|eval-rag-offline|check-github-action-pins|check-codex-autofix-workflow)\.mjs$/,
];

const codexAutofixPatterns = [
  ".github/workflows/codex-autofix-review-comments.yml",
  "AGENTS.md",
  "docs/codex-review-protocol.md",
  "scripts/check-codex-autofix-workflow.mjs",
];

const uiPatterns = [
  "data",
  "src/app",
  "src/components",
  "src/styles",
  "public",
  /^tests\/ui-.*\.spec\.ts$/,
  /^tests\/playwright-.*\.ts$/,
  /^playwright(?:\..*)?\.config\.ts$/,
  /^scripts\/(run-playwright|playwright-base-url)\.mjs$/,
];

const dbPatterns = [
  "supabase",
  "src/lib/supabase",
  "src/app/api/answer",
  "src/app/api/differentials",
  "src/app/api/documents",
  "src/app/api/eval-cases",
  "src/app/api/health",
  "src/app/api/images",
  "src/app/api/ingestion",
  "src/app/api/jobs",
  "src/app/api/medications",
  "src/app/api/registry",
  "src/app/api/search",
  "src/app/api/setup-status",
  "src/app/api/upload",
  "docs/database-drift-detection.md",
  "docs/supabase-migration-reconciliation.md",
  /^scripts\/(check-drift|generate-drift-manifest|check-m13-migration|check-retrieval-owner-migration|check-supabase-project|audit-tables|reindex|reindex-health|cleanup-abandoned-reindex-generations)\.ts$/,
  /^tests\/(supabase|drift|private-rag|private-access|retrieval-owner).*\.test\.ts$/,
];

// NOTE: rag_eval_changed is an ADVISORY narrowing signal only. The clinical
// offline-grounding gate (eval:rag:offline) runs for every non-docs change in
// both CI (.github/workflows/ci.yml) and local verify:pr-local, so a new
// retrieval file that falls outside these patterns can never silently skip it.
const ragEvalPatterns = [
  "scripts/fixtures",
  "src/app/api/answer",
  "src/app/api/search",
  /^src\/lib\/(?:rag(?:-[^/]+)?|smart-rag-api|clinical-search|clinical-query-mode|retrieval(?:-[^/]+)?|answer(?:-[^/]+)?|citations|cross-document-synthesis|evidence(?:-[^/]+)?|ranking-config|source(?:-[^/]+)?|chunking|document-index-units|query-privacy|owner-scope|corpus-grounding|indexed-source-formatting)\.ts$/,
  /^src\/components\/(?:.*\/)?(?:answer|source|citation)[^/]*\.tsx?$/i,
  /^scripts\/(eval-|run-eval-safe|compare-retrieval-eval|retrieval-health|profile-retrieval|warm-retrieval-cache|tune-search-weights)/,
  /^tests\/(rag|retrieval|answer|citations|evidence|eval|clinical-safety|source).*\.test\.ts$/,
];

const containerPatterns = [
  "Dockerfile",
  "Dockerfile.worker",
  ".dockerignore",
  ".npmrc",
  ".nvmrc",
  "next.config.ts",
  "package.json",
  "package-lock.json",
  "railway.app.json",
  "railway.worker.json",
  "worker/python/requirements.txt",
  /^scripts\/(check-node-engine|guard-next-build|build-worker)\.(?:cjs|mjs)$/,
];

const sourcePatterns = ["data", "src", "tests", "scripts", "worker", "playwright", "public", "supabase"];

const coveragePatterns = ["data", "src", "tests", "vitest.config.mts"];

const buildPatterns = [
  "bundle-budget.json",
  "data",
  "src",
  "worker",
  "public",
  "next.config.ts",
  "tsconfig.json",
  "postcss.config.mjs",
  "package.json",
  "package-lock.json",
  "scripts/check-bundle-budget.mjs",
  /^scripts\/(check-node-engine|guard-next-build|dev-free-port|ensure-local-server)\.(?:cjs|mjs)$/,
];

const staticConfigPatterns = [
  "eslint.config.mjs",
  "playwright.config.ts",
  "playwright.visual.config.ts",
  "vitest.config.mts",
];

// Dependency-manifest changes are the only moment a PR can introduce a new
// (possibly-vulnerable) dependency, so `npm audit` blocks the merge gate only
// when one of these changes; otherwise the audit runs advisory. Scheduled/
// full-run passes resolve to the sentinel below, which includes these paths.
const lockfilePatterns = ["package.json", "package-lock.json", ".npmrc"];

function classify(files) {
  const normalized = [...new Set(files.map(normalizePath).filter(Boolean))].sort();
  const sourceChanged = normalized.some((file) => pathMatches(file, [...sourcePatterns, ...staticConfigPatterns]));
  const coverageChanged = normalized.some((file) => pathMatches(file, coveragePatterns));
  const uiChanged = normalized.some((file) => pathMatches(file, uiPatterns));
  const dbChanged = normalized.some((file) => pathMatches(file, dbPatterns));
  const containerChanged = normalized.some((file) => pathMatches(file, containerPatterns));
  const ragEvalChanged = normalized.some((file) => pathMatches(file, ragEvalPatterns));
  const workflowChanged = normalized.some((file) => pathMatches(file, workflowPatterns));
  const codexAutofixChanged = normalized.some((file) => pathMatches(file, codexAutofixPatterns));
  const lockfileChanged = normalized.some((file) => pathMatches(file, lockfilePatterns));
  const buildChanged = normalized.some((file) => pathMatches(file, buildPatterns)) || containerChanged;
  const docsOnly =
    normalized.length > 0 &&
    normalized.every((file) => pathMatches(file, docPatterns)) &&
    !sourceChanged &&
    !workflowChanged;

  return {
    files: normalized,
    docs_only: docsOnly,
    source_changed: sourceChanged,
    coverage_changed: coverageChanged,
    ui_changed: uiChanged,
    db_changed: dbChanged,
    container_changed: containerChanged,
    rag_eval_changed: ragEvalChanged,
    workflow_changed: workflowChanged,
    codex_autofix_changed: codexAutofixChanged,
    build_changed: buildChanged,
    lockfile_changed: lockfileChanged,
  };
}

function parseStatusPorcelain(raw) {
  if (!raw) return [];
  const fields = raw.split("\0").filter(Boolean);
  const files = [];

  for (let index = 0; index < fields.length; index += 1) {
    const entry = fields[index];
    const status = entry.slice(0, 2);
    const pathPart = entry.slice(3);
    if (status.includes("R") || status.includes("C")) {
      const originalPath = fields[index + 1];
      files.push(pathPart);
      if (originalPath) {
        files.push(originalPath);
        index += 1;
      }
      continue;
    }
    files.push(pathPart);
  }

  return files;
}

function changedFilesFromStatus() {
  return parseStatusPorcelain(runGitRaw(["status", "--porcelain=v1", "-z", "--untracked-files=all"]));
}

function parseNameStatus(raw) {
  const fields = raw.split("\0").filter(Boolean);
  const files = [];

  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    const firstPath = fields[index++];
    if (!status || !firstPath) break;

    files.push(firstPath);
    if (/^[RC]/.test(status)) {
      const secondPath = fields[index++];
      if (secondPath) files.push(secondPath);
    }
  }

  return files;
}

function changedFilesFromRange(base, head) {
  if (!base || !head || zeroSha.test(base) || zeroSha.test(head)) return null;
  try {
    return parseNameStatus(runGitRaw(["diff", "--name-status", "-z", "--find-renames", `${base}...${head}`]));
  } catch {
    try {
      return parseNameStatus(runGitRaw(["diff", "--name-status", "-z", "--find-renames", base, head]));
    } catch {
      // Unreachable base (e.g. force-push). Fall through to the full-run
      // sentinel rather than failing the whole changes job.
      return null;
    }
  }
}

function refExists(ref) {
  try {
    runGit(["rev-parse", "--verify", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function isBaseBranchRef(ref) {
  return /(?:^|\/)(?:main|master|develop|release\/.+)$/.test(ref);
}

function resolveLocalBaseRef(args) {
  const explicit = getArgValue(args, "--base-ref") ?? process.env.PR_BASE_REF ?? process.env.GITHUB_BASE_REF ?? "";
  if (explicit) {
    if (!refExists(explicit)) throw new Error(`Local PR base ref does not exist: ${explicit}`);
    return explicit;
  }

  let upstream = "";
  try {
    upstream = runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
    if (isBaseBranchRef(upstream)) return upstream;
  } catch {
    // A local-only feature branch can still resolve the remote default branch below.
  }

  try {
    const remoteHead = runGit(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
    if (remoteHead && refExists(remoteHead)) return remoteHead;
  } catch {
    // Fall through to conventional base names.
  }

  for (const candidate of ["origin/main", "origin/master", "origin/develop", "main", "master", "develop"]) {
    if (refExists(candidate)) return candidate;
  }

  return null;
}

function changedFilesFromLocal(args) {
  const statusFiles = changedFilesFromStatus();
  const baseRef = resolveLocalBaseRef(args);
  if (!baseRef) return [...fullRunSentinelFiles, ...statusFiles];

  try {
    const mergeBase = runGit(["merge-base", "HEAD", baseRef]);
    return [...(changedFilesFromRange(mergeBase, "HEAD") ?? []), ...statusFiles];
  } catch {
    return [...fullRunSentinelFiles, ...statusFiles];
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
    return fullRunSentinelFiles;
  }

  return changedFilesFromLocal(args);
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
  const result = classify(files);
  for (const [key, value] of Object.entries(expected)) {
    if (result[key] !== value) {
      throw new Error(`${name}: expected ${key}=${value}, received ${result[key]} for ${files.join(", ")}`);
    }
  }
}

function selfTest() {
  assertScope("unstaged-status", parseStatusPorcelain(" M scripts/ci-change-scope.mjs\0"), {
    source_changed: true,
    workflow_changed: true,
  });
  assertScope("docs-only", ["docs/process-note.md"], {
    docs_only: true,
    source_changed: false,
    build_changed: false,
    lockfile_changed: false,
  });
  assertScope("tests-only", ["tests/rag-routing.test.ts"], {
    source_changed: true,
    coverage_changed: true,
    build_changed: false,
  });
  assertScope("coverage-config", ["vitest.config.mts"], {
    source_changed: true,
    coverage_changed: true,
  });
  assertScope("runtime-data", ["data/medications-snapshot.json"], {
    source_changed: true,
    coverage_changed: true,
    ui_changed: true,
    build_changed: true,
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
    build_changed: false,
  });
  assertScope(
    "rag",
    [
      "src/app/api/answer/route.ts",
      "src/lib/corpus-grounding.ts",
      "src/components/clinical-dashboard/answer-content.tsx",
    ],
    {
      rag_eval_changed: true,
      source_changed: true,
    },
  );
  assertScope("rag-fixture", ["src/lib/retrieval-selection.ts", "scripts/fixtures/rag-retrieval-golden.json"], {
    rag_eval_changed: true,
    source_changed: true,
  });
  // A RAG-relevant lib file outside ragEvalPatterns must still be caught as a
  // source change (so static-pr and the non-docs safety job / verify:pr-local,
  // which run the offline grounding gate, always execute). Guards the "silent
  // scope narrowing" gap.
  assertScope("rag-lib-outside-allowlist", ["src/lib/hybrid-reranker.ts"], {
    source_changed: true,
    coverage_changed: true,
    docs_only: false,
  });
  assertScope("database-access", ["src/app/api/documents/route.ts"], {
    db_changed: true,
    source_changed: true,
  });
  assertScope("workflow", [".github/workflows/ci.yml", "docs/process-hardening.md"], {
    workflow_changed: true,
    docs_only: false,
    build_changed: false,
  });
  assertScope(
    "codex-autofix",
    [".github/workflows/codex-autofix-review-comments.yml", "AGENTS.md", "scripts/check-codex-autofix-workflow.mjs"],
    {
      workflow_changed: true,
      codex_autofix_changed: true,
      build_changed: false,
    },
  );
  assertScope("package", ["package.json"], {
    source_changed: false,
    coverage_changed: false,
    container_changed: true,
    workflow_changed: false,
    build_changed: true,
    lockfile_changed: true,
  });
  assertScope("lockfile", ["package-lock.json"], {
    lockfile_changed: true,
    build_changed: true,
    container_changed: true,
  });
  assertScope("npmrc", [".npmrc"], {
    lockfile_changed: true,
    container_changed: true,
  });
  assertScope("source-only-no-lockfile", ["src/lib/rag.ts"], {
    source_changed: true,
    lockfile_changed: false,
  });
  assertScope("bundle-budget-config", ["bundle-budget.json"], {
    build_changed: true,
  });
  assertScope("bundle-budget-checker", ["scripts/check-bundle-budget.mjs"], {
    source_changed: true,
    build_changed: true,
  });
  assertScope(
    "container",
    ["Dockerfile.worker", "railway.app.json", "railway.worker.json", "worker/python/requirements.txt"],
    {
      container_changed: true,
      build_changed: true,
    },
  );
  assertScope("renamed-destination", parseStatusPorcelain("R  src/lib/rag-new.ts\0docs/rag-old.md\0"), {
    source_changed: true,
    rag_eval_changed: true,
    docs_only: false,
  });
  assertScope("ranged-rename", parseNameStatus("R100\0src/lib/rag-old.ts\0docs/rag-old.md\0"), {
    source_changed: true,
    rag_eval_changed: true,
    docs_only: false,
  });
  assertScope("unknown-base-full-run", fullRunSentinelFiles, {
    source_changed: true,
    coverage_changed: true,
    ui_changed: true,
    db_changed: true,
    container_changed: true,
    rag_eval_changed: true,
    workflow_changed: true,
    codex_autofix_changed: true,
    build_changed: true,
    lockfile_changed: true,
  });
  console.log("CI change scope self-test passed.");
}

const args = process.argv.slice(2);
if (args.includes("--self-test")) {
  selfTest();
  process.exit(0);
}

const result = classify(resolveChangedFiles(args));
if (args.includes("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else {
  writeOutputs(result);
}
