import { join } from "node:path";
import { readdir, readFile } from "node:fs/promises";

// Default cost threshold per RAG query ($0.005)
const DEFAULT_COST_CAP_USD = 0.005;
const EVALS_DIR = join(process.cwd(), "output", "evals");

async function main() {
  const maxCostStr = process.env.MAX_RAG_COST_USD ?? String(DEFAULT_COST_CAP_USD);
  const maxCost = Number.parseFloat(maxCostStr);

  console.log(`Checking latest RAG evaluation report for cost cap compliance (threshold: $${maxCost})...`);

  let files: string[];
  try {
    files = await readdir(EVALS_DIR);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      console.log("No output/evals directory found. Passing by default (evals haven't run).");
      return;
    }
    throw error;
  }

  const reportFiles = files
    .filter((f) => f.startsWith("retrieval-quality-") && f.endsWith(".json"))
    .sort();

  if (reportFiles.length === 0) {
    console.log("No retrieval-quality-*.json files found. Passing by default.");
    return;
  }

  const latestFile = reportFiles[reportFiles.length - 1];
  const reportPath = join(EVALS_DIR, latestFile);
  console.log(`Analyzing latest report: ${latestFile}`);

  const content = await readFile(reportPath, "utf8");
  const report = JSON.parse(content);

  const ragSummary = report.rag;
  if (!ragSummary) {
    console.log("Report does not contain RAG summary. Passing by default.");
    return;
  }

  const totalCost = ragSummary.estimated_cost_usd;
  const numCases = Array.isArray(ragSummary.results) ? ragSummary.results.length : (ragSummary.case_count || 0);

  if (typeof totalCost !== "number" || numCases === 0) {
    console.log("Valid cost or cases data not found in report. Passing by default.");
    return;
  }

  const averageCost = totalCost / numCases;
  console.log(`Total RAG Cost: $${totalCost.toFixed(5)} across ${numCases} cases.`);
  console.log(`Average cost per case: $${averageCost.toFixed(5)}`);

  if (averageCost > maxCost) {
    console.error(`\n[COST CAP EXCEEDED] Average RAG cost ($${averageCost.toFixed(5)}) exceeds the threshold ($${maxCost.toFixed(5)}).`);
    console.error(`Check prompts, chunk retrieval bounds, or token estimation rules.`);
    process.exit(1);
  }

  console.log(`[COST CAP OK] Average RAG cost is within acceptable limits.`);
}

main().catch((error) => {
  console.error("Error in cost cap preflight:", error);
  process.exit(1);
});
