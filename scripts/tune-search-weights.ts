import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tuneRankingSnapshot, validateRankingSnapshot } from "./lib/ranking-tuning";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function main() {
  const snapshotPath = resolve(argument("--snapshot") ?? "scripts/fixtures/rag-ranking-candidate-snapshot.v1.json");
  const snapshot = validateRankingSnapshot(JSON.parse(readFileSync(snapshotPath, "utf8")));
  const recommendations = tuneRankingSnapshot(snapshot);
  console.log(
    JSON.stringify(
      {
        snapshot: { schema: snapshot.schema, version: snapshot.version, cases: snapshot.cases.length },
        objective: "0.55*mrr@10 + 0.35*ndcg@10 + 0.10*hard_negative_accuracy",
        constraints: [
          "document_recall@5_no_regression",
          "content_recall@5_no_regression",
          "no_high_risk_hard_negative_failure",
          "closest_improving_coordinate",
        ],
        recommendations,
      },
      null,
      2,
    ),
  );
}

main();
