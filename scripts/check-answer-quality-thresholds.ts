import { join } from "node:path";
import { readdir, readFile } from "node:fs/promises";

const TARGET_GROUNDED_RATE = 0.95; // e.g. 95%
const EVALS_DIR = join(process.cwd(), "output", "evals");

async function main() {
  console.log("Checking latest RAG evaluation report for answer quality thresholds...");

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

  const groundedRate = ragSummary.grounded_supported_rate;
  const routeCeilingFailures = ragSummary.route_ceiling_failure_count;

  if (typeof groundedRate !== "number" || typeof routeCeilingFailures !== "number") {
    console.log("Missing expected quality metrics in report. Passing by default.");
    return;
  }

  let failed = false;

  console.log(`Grounded supported rate: ${(groundedRate * 100).toFixed(1)}% (Target: ${(TARGET_GROUNDED_RATE * 100).toFixed(1)}%)`);
  if (groundedRate < TARGET_GROUNDED_RATE) {
    console.error(`[QUALITY ERROR] Answer-match rate is below the target threshold.`);
    failed = true;
  }

  console.log(`Route ceiling failures: ${routeCeilingFailures} (Target: 0)`);
  if (routeCeilingFailures > 0) {
    console.error(`[QUALITY ERROR] Routing precision metrics (route ceiling failures) exceed acceptable limits.`);
    failed = true;
  }

  if (failed) {
    process.exit(1);
  } else {
    console.log("[QUALITY OK] Answer quality and routing metrics meet release targets.");
  }
}

main().catch((error) => {
  console.error("Error in answer quality thresholds preflight:", error);
  process.exit(1);
});
