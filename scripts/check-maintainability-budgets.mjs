#!/usr/bin/env node
import { readFileSync } from "node:fs";

const budgets = new Map([
  ["src/components/ClinicalDashboard.tsx", 4140],
  ["src/lib/rag/rag.ts", 5030],
  ["src/components/DocumentViewer.tsx", 1734],
  ["supabase/functions/indexing-v3-agent/index.ts", 2191],
]);

function sourceLineCount(file) {
  const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
  const lines = source.split("\n");
  return source.endsWith("\n") ? lines.length - 1 : lines.length;
}

const failures = [];
const summary = [];

for (const [file, maximum] of budgets) {
  const actual = sourceLineCount(file);
  const percentage = Math.round((actual / maximum) * 100);
  const headroom = maximum - actual;
  
  // Progress bar visualization (20 chars wide)
  const filledLength = Math.floor((actual / maximum) * 20);
  const emptyLength = Math.max(0, 20 - filledLength);
  const progressBar = `[${"█".repeat(Math.min(20, filledLength))}${"░".repeat(emptyLength)}]`;

  summary.push(`${progressBar} ${percentage}% | ${String(headroom).padStart(4)} lines left | ${file}`);

  if (actual > maximum) failures.push(`${file}: ${actual} lines exceeds the ${maximum}-line no-growth budget`);
}

console.log("Maintainability Budgets Headroom Summary:");
for (const line of summary) console.log(`  ${line}`);

if (failures.length) {
  console.error("\nMaintainability hotspot budget exceeded. Extract a cohesive module instead of growing the monolith:");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log("\nMaintainability hotspot budgets passed.");
