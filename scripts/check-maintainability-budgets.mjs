#!/usr/bin/env node
import { readFileSync } from "node:fs";

const budgets = new Map([
  // Chrome ownership/reporting lives in use-dashboard-chrome-coordinator; keep
  // the reclaimed monolith budget so it cannot silently drift back to 4160.
  ["src/components/ClinicalDashboard.tsx", 4140],
  // Evidence coverage, per-request hydration, and second-stage ranking live in
  // focused rag modules; keep the reclaimed budget so it cannot silently drift back.
  ["src/lib/rag/rag.ts", 4351],
  ["src/components/DocumentViewer.tsx", 1734],
  ["supabase/functions/indexing-v3-agent/index.ts", 2191],
]);

function sourceLineCount(file) {
  const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
  const lines = source.split("\n");
  return source.endsWith("\n") ? lines.length - 1 : lines.length;
}

const failures = [];
for (const [file, maximum] of budgets) {
  const actual = sourceLineCount(file);
  if (actual > maximum) failures.push(`${file}: ${actual} lines exceeds the ${maximum}-line no-growth budget`);
  else console.log(`[maintainability] ${file}: ${actual}/${maximum} lines`);
}

if (failures.length) {
  console.error("Maintainability hotspot budget exceeded. Extract a cohesive module instead of growing the monolith:");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log("Maintainability hotspot budgets passed.");
