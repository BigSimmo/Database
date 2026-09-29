import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { ExtractShapeError, parseExtractPayload } from "../scripts/audit-formatting-fixtures";

describe("formatting fixture audit", () => {
  // `payload.images ?? []` turned "this key is missing" into "there is nothing
  // here". Both printed `0 issue(s)` and exited 0. The same substitution let the
  // source-governance audit report success over 835 catalogue records it never
  // loaded, and its reviewer gate pass over 1,935 documents it never examined.
  describe("parseExtractPayload", () => {
    it("reads images and pages when they are present", () => {
      expect(parseExtractPayload({ images: [{ a: 1 }], pages: [{ b: 2 }] }, "f.json")).toEqual({
        images: [{ a: 1 }],
        pages: [{ b: 2 }],
      });
    });

    it("accepts one section absent while the other is present", () => {
      expect(parseExtractPayload({ images: [{ a: 1 }] }, "f.json")).toEqual({ images: [{ a: 1 }], pages: [] });
      expect(parseExtractPayload({ pages: [] }, "f.json")).toEqual({ images: [], pages: [] });
    });

    it("refuses a payload carrying neither section, and names the keys it did find", () => {
      expect(() => parseExtractPayload({ imageList: [], pageList: [] }, "f.json")).toThrow(ExtractShapeError);
      expect(() => parseExtractPayload({ imageList: [], pageList: [] }, "f.json")).toThrow(/imageList, pageList/);
    });

    it("refuses a section present with the wrong type rather than reading it as empty", () => {
      expect(() => parseExtractPayload({ images: {} }, "f.json")).toThrow(/"images" is present but is not an array/);
      expect(() => parseExtractPayload({ images: [], pages: "none" }, "f.json")).toThrow(
        /"pages" is present but is not an array/,
      );
    });

    it("refuses a payload that is not a JSON object", () => {
      expect(() => parseExtractPayload([], "f.json")).toThrow(ExtractShapeError);
      expect(() => parseExtractPayload(null, "f.json")).toThrow(ExtractShapeError);
      expect(() => parseExtractPayload("{}", "f.json")).toThrow(ExtractShapeError);
    });
  });

  it("refuses an unreadable payload at the command line instead of reporting a clean run", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "formatting-audit-shape-"));
    const fixture = path.join(dir, "extract.json");
    await writeFile(fixture, JSON.stringify({ imageList: [], pageList: [] }), "utf8");

    const result = spawnSync("node", ["scripts/run-tsx.mjs", "scripts/audit-formatting-fixtures.ts", fixture], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("is not an extractor payload this audit can check");
    expect(result.stdout).not.toContain("0 issue(s)");
  });

  it("states how many images and pages it examined, so a clean run cannot hide an empty one", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "formatting-audit-counts-"));
    const fixture = path.join(dir, "extract.json");
    await writeFile(
      fixture,
      JSON.stringify({ images: [{ width: 100, height: 100 }], pages: [{ pageNumber: 1 }] }),
      "utf8",
    );

    const result = spawnSync("node", ["scripts/run-tsx.mjs", "scripts/audit-formatting-fixtures.ts", fixture], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("1 file(s), 1 image(s), 1 page(s), 0 issue(s)");
  });

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
