import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("formatting fixture audit", () => {
  it("reports page-level formatting risks from extractor JSON without provider access", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "formatting-audit-"));
    const fixture = path.join(dir, "extract.json");
    await writeFile(
      fixture,
      JSON.stringify({
        pages: [{ pageNumber: 2, needsOcr: true }],
        images: [
          {
            sourceKind: "table_crop",
            width: 1600,
            height: 260,
            metadata: {
              crop_completeness: 0.72,
              rows_truncated: true,
              structured_extraction_confidence: 0.42,
              ocr_text_density: 0.1,
            },
          },
        ],
      }),
      "utf8",
    );

    const result = spawnSync("node", ["scripts/run-tsx.mjs", "scripts/audit-formatting-fixtures.ts", fixture], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("table rows truncated");
    expect(result.stdout).toContain("crop cut-off risk");
    expect(result.stdout).toContain("extreme image aspect ratio");
    expect(result.stdout).toContain("page needs OCR");
  });
});
