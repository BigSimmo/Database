function normalizePath(filePath) {
  return filePath
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/^github\//, ".github/");
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
  ".github/dependabot.yml",
  ".github/pull_request_template.md",
  "AGENTS.md",
  "docs/codex-review-protocol.md",
  "docs/process-hardening.md",
  "package.json",
  "package-lock.json",
  /^scripts\/(?:ci-change-scope|check-(?:client-bundle-secrets|github-action-pins|codex-autofix-workflow))\.mjs$/,
  /^scripts\/lib\/(?:ci-change-scope|pr-local-plan)\.mjs$/,
  /^scripts\/verify-pr-local\.mjs$/,
];

const uiPatterns = [
  "src/app",
  "src/components",
  "src/styles",
  "public",
  /^src\/lib\/(app-modes|public-env|deployed-app|mode-home-composer)\.ts$/,
  /^tests\/ui-.*\.spec\.ts$/,
  /^tests\/playwright-.*\.ts$/,
  /^playwright(?:\..*)?\.config\.ts$/,
  /^scripts\/(run-playwright|playwright-base-url)\.mjs$/,
];

const dbPatterns = [
  "supabase",
  "src/lib/supabase",
  "docs/database-drift-detection.md",
  "docs/supabase-migration-reconciliation.md",
  /^scripts\/(check-drift|generate-drift-manifest|check-m13-migration|check-retrieval-owner-migration|check-supabase-project|audit-tables|reindex|reindex-health|cleanup-abandoned-reindex-generations)\.ts$/,
  /^tests\/(supabase|drift|private-rag|private-access|retrieval-owner).*\.test\.ts$/,
];

const ragEvalPatterns = [
  "scripts/fixtures",
  "scripts/lib/eval-rag-offline-production.ts",
  /^src\/app\/api\/(?:answer|search)(?:\/|$)/,
  /^src\/app\/api\/documents\/[^/]+\/search(?:\/|$)/,
  /^src\/components\/clinical-dashboard\/(?:answer-|source-)/,
  /^src\/lib\/(rag|smart-rag-api|rag-provider|rag-routing|clinical-search|clinical-query-mode|retrieval-selection|answer-ranking|answer-verification|answer-formatting|answer-follow-up|answer-render-policy|citations|cross-document-synthesis|evidence-relevance|ranking-config|source-governance|source-metadata|chunking|document-index-units|query-privacy|owner-scope)(?:\.ts|\/)/,
  /^scripts\/(eval-|run-eval-safe|compare-retrieval-eval|retrieval-health|profile-retrieval|warm-retrieval-cache|tune-search-weights)/,
  /^tests\/(rag|retrieval|answer|citations|evidence|eval|clinical-safety|source).*\.test\.ts$/,
];

const containerPatterns = [
  "Dockerfile",
  "Dockerfile.worker",
  ".dockerignore",
  ".env.example",
  ".npmrc",
  ".nvmrc",
  "next.config.ts",
  "package.json",
  "package-lock.json",
  "worker/python/requirements.txt",
  /^scripts\/(check-node-engine|guard-next-build)\.(?:cjs|mjs)$/,
];

const sourcePatterns = [
  "src",
  "tests",
  "scripts",
  "worker",
  "playwright",
  "public",
  "supabase",
  ".env.example",
  ".npmrc",
  ".nvmrc",
  "eslint.config.mjs",
  "next.config.ts",
  "playwright.config.ts",
  "playwright.visual.config.ts",
  "vitest.config.mts",
  "tsconfig.json",
  "postcss.config.mjs",
  "package.json",
  "package-lock.json",
];

// Sentinel used when CI cannot compute a real diff (manual dispatch, schedule,
// unreachable force-push base). It must light up EVERY scope lane so full-run
// events exercise the complete gate set — classifyChangedFiles(sentinel) is
// asserted in the self-test to keep new lanes from silently skipping.
export const fullRunSentinelFiles = [
  ".github/workflows/ci.yml",
  "Dockerfile",
  "scripts/fixtures/__ci_full_run__.json",
  "src/app/__ci_full_run__.ts",
  "supabase/__ci_full_run__.sql",
];

export function classifyChangedFiles(files) {
  const normalized = [...new Set(files.map(normalizePath).filter(Boolean))].sort();
  const sourceChanged = normalized.some((file) => pathMatches(file, sourcePatterns));
  const uiChanged = normalized.some((file) => pathMatches(file, uiPatterns));
  const dbChanged = normalized.some((file) => pathMatches(file, dbPatterns));
  const containerChanged = normalized.some((file) => pathMatches(file, containerPatterns));
  const ragEvalChanged = normalized.some((file) => pathMatches(file, ragEvalPatterns));
  const workflowChanged = normalized.some((file) => pathMatches(file, workflowPatterns));
  const docsOnly =
    normalized.length > 0 &&
    normalized.every((file) => pathMatches(file, docPatterns)) &&
    !sourceChanged &&
    !workflowChanged;

  return {
    files: normalized,
    docs_only: docsOnly,
    source_changed: sourceChanged,
    ui_changed: uiChanged,
    db_changed: dbChanged,
    container_changed: containerChanged,
    rag_eval_changed: ragEvalChanged,
    workflow_changed: workflowChanged,
    build_changed: sourceChanged || containerChanged,
  };
}

export function parsePorcelainV1Z(raw) {
  if (!raw) return [];
  const fields = raw.split("\0");
  const files = [];

  for (let index = 0; index < fields.length; index += 1) {
    const entry = fields[index];
    if (!entry) continue;
    const status = entry.slice(0, 2);
    const pathPart = entry.slice(3);
    if (pathPart) files.push(pathPart);

    if (status.includes("R") || status.includes("C")) {
      const pairedPath = fields[index + 1];
      if (pairedPath) files.push(pairedPath);
      index += 1;
    }
  }

  return files;
}
