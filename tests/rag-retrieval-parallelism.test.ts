import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("retrieval hydration parallelism", () => {
  it("overlaps only independent metadata and memory reads before deterministic assembly", () => {
    const source = readFileSync("src/lib/rag/rag-hydration.ts", "utf8");
    const helper = source.slice(
      source.indexOf("export async function hydrateCandidatesWithMetadataAndMemory"),
      source.indexOf("/** Attach document ranking metadata. */"),
    );

    expect(helper).toContain("Promise.all([");
    expect(helper).toContain("attachDocumentRankingMetadata(");
    expect(helper).toContain("loadMemoryBoostArtifacts({");
    expect(helper.indexOf("applyMemoryBoostArtifacts(")).toBeGreaterThan(helper.indexOf("Promise.all(["));
  });

  it("uses the parallel helper on all post-gate vector and document-lookup branches", () => {
    const source = readFileSync("src/lib/rag/rag.ts", "utf8");
    const callCount = source.match(/await hydrateCandidatesWithMetadataAndMemory\(\{/g)?.length ?? 0;

    expect(callCount).toBe(3);
  });
});
