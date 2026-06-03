import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  buildImportStoragePath,
  formatExactDuplicateSkip,
  matchesInclude,
  parseImportCliArgs,
  scanImportFiles,
  safeFileName,
  titleFromFileName,
} from "../src/lib/bulk-import";

describe("bulk import helpers", () => {
  it("parses the required local folder importer arguments", () => {
    const args = parseImportCliArgs([
      "--path",
      "D:\\Clinical PDFs",
      "--owner-email",
      "joshsimpson@outlook.com.au",
      "--batch-name",
      "Initial guideline import",
      "--include",
      "**/*.pdf",
      "--limit",
      "25",
      "--dry-run",
    ]);

    expect(args).toMatchObject({
      path: "D:\\Clinical PDFs",
      ownerEmail: "joshsimpson@outlook.com.au",
      batchName: "Initial guideline import",
      include: "**/*.pdf",
      limit: 25,
      dryRun: true,
    });
  });

  it("matches recursive PDF includes only", () => {
    expect(matchesInclude("folder/guideline.pdf")).toBe(true);
    expect(matchesInclude("folder/guideline.docx")).toBe(false);
  });

  it("scans and hashes PDFs in stable order", async () => {
    const root = path.join(tmpdir(), `clinical-kb-import-${Date.now()}`);
    await mkdir(path.join(root, "nested"), { recursive: true });
    await writeFile(path.join(root, "b.pdf"), "beta");
    await writeFile(path.join(root, "nested", "a.pdf"), "alpha");
    await writeFile(path.join(root, "skip.txt"), "skip");

    const files = await scanImportFiles(root);

    expect(files.map((file) => file.relativePath.replaceAll("\\", "/"))).toEqual(["b.pdf", "nested/a.pdf"].sort());
    expect(files[0].contentHash).toHaveLength(64);
  });

  it("limits recursive scans after stable ordering", async () => {
    const root = path.join(tmpdir(), `clinical-kb-import-limit-${Date.now()}`);
    await mkdir(path.join(root, "nested"), { recursive: true });
    await writeFile(path.join(root, "b.pdf"), "beta");
    await writeFile(path.join(root, "a.pdf"), "alpha");
    await writeFile(path.join(root, "nested", "c.pdf"), "charlie");

    const files = await scanImportFiles(root, "**/*.pdf", 2);

    expect(files.map((file) => file.relativePath.replaceAll("\\", "/"))).toEqual(["a.pdf", "b.pdf"]);
  });

  it("normalizes file names and storage paths", () => {
    expect(safeFileName("a/b?c.pdf")).toBe("a_b_c.pdf");
    expect(titleFromFileName("Guideline.pdf")).toBe("Guideline");
    expect(buildImportStoragePath("owner", "doc", "a/b?c.pdf")).toBe("owner/documents/doc/a_b_c.pdf");
  });

  it("formats exact-copy duplicate skips for importer output", () => {
    expect(
      formatExactDuplicateSkip(
        { relativePath: "folder/guideline.pdf" },
        {
          id: "doc-1",
          title: "Existing guideline",
          storage_path: "owner/documents/doc-1/guideline.pdf",
          source_path: "D:\\Clinical PDFs\\guideline.pdf",
        },
      ),
    ).toBe(
      'DUPLICATE exact copy skipped folder/guideline.pdf (matches "Existing guideline" at D:\\Clinical PDFs\\guideline.pdf)',
    );
  });

  it("formats exact-copy duplicate skips for dry-run output", () => {
    expect(
      formatExactDuplicateSkip(
        { relativePath: "folder/guideline.pdf" },
        {
          id: "doc-1",
          title: "Existing guideline",
          storage_path: "owner/documents/doc-1/guideline.pdf",
        },
        { dryRun: true },
      ),
    ).toBe(
      'DRY RUN DUPLICATE exact copy would be skipped folder/guideline.pdf (matches "Existing guideline" at owner/documents/doc-1/guideline.pdf)',
    );
  });
});
