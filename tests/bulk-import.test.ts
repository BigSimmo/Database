import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  buildImportStoragePath,
  chunkImportFiles,
  DEFAULT_IMPORT_BATCH_SIZE,
  DEFAULT_IMPORT_INCLUDE,
  formatExactDuplicateSkip,
  importMimeType,
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
      queueBatchSize: DEFAULT_IMPORT_BATCH_SIZE,
      dryRun: true,
    });
  });

  it("defaults to supported document imports in 20-file queue batches", () => {
    const args = parseImportCliArgs(["--path", "D:\\Clinical PDFs"]);

    expect(args.include).toBe(DEFAULT_IMPORT_INCLUDE);
    expect(args.queueBatchSize).toBe(20);
  });

  it("parses custom queue batch sizes", () => {
    const args = parseImportCliArgs(["--path", "D:\\Clinical PDFs", "--queue-batch-size", "10"]);

    expect(args.queueBatchSize).toBe(10);
  });

  it("rejects invalid queue batch sizes", () => {
    expect(() => parseImportCliArgs(["--path", "D:\\Clinical PDFs", "--queue-batch-size", "0"])).toThrow(
      "--queue-batch-size must be a positive integer.",
    );
  });

  it("matches supported document includes by default", () => {
    expect(matchesInclude("folder/guideline.pdf")).toBe(true);
    expect(matchesInclude("folder/guideline.docx", DEFAULT_IMPORT_INCLUDE)).toBe(true);
    expect(matchesInclude("folder/table.xlsx", DEFAULT_IMPORT_INCLUDE)).toBe(true);
    expect(matchesInclude("folder/note.txt", DEFAULT_IMPORT_INCLUDE)).toBe(true);
    expect(matchesInclude("folder/image.png", DEFAULT_IMPORT_INCLUDE)).toBe(false);
  });

  it("still supports explicit PDF-only includes", () => {
    expect(matchesInclude("folder/guideline.pdf", "**/*.pdf")).toBe(true);
    expect(matchesInclude("folder/guideline.docx", "**/*.pdf")).toBe(false);
  });

  it("scans and hashes PDFs in stable order", async () => {
    const root = path.join(tmpdir(), `clinical-kb-import-${Date.now()}`);
    await mkdir(path.join(root, "nested"), { recursive: true });
    await writeFile(path.join(root, "b.pdf"), "beta");
    await writeFile(path.join(root, "nested", "a.pdf"), "alpha");
    await writeFile(path.join(root, "skip.png"), "skip");

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

  it("maps supported import files to worker-compatible mime types", () => {
    expect(importMimeType("guideline.pdf")).toBe("application/pdf");
    expect(importMimeType("policy.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(importMimeType("monitoring.xlsx")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(importMimeType("note.txt")).toBe("text/plain");
  });

  it("chunks imports into configured queue batches", () => {
    expect(chunkImportFiles([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkImportFiles(Array.from({ length: 41 }, (_, index) => index)).map((batch) => batch.length)).toEqual([
      20,
      20,
      1,
    ]);
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
