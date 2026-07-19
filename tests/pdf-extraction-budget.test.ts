import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import PDFDocument from "pdfkit";
import { PDFParse } from "pdf-parse";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractPdf, runPythonPdfExtractor } from "@/lib/extractors/document";
import {
  PDF_EXTRACTION_BUDGET,
  PdfExtractionBudgetTracker,
  PdfExtractionResourceError,
} from "@/lib/extractors/pdf-extraction-budget";
import { isRetryableIngestionError } from "@/lib/ingestion";

const roots: string[] = [];

async function createTextPdf() {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const document = new PDFDocument();
    document.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.text("This extracted text is deliberately longer than one byte.");
    document.end();
  });
}

async function createImagePdf() {
  const image = await readFile(new URL("../public/demo-documents/risk-flow.png", import.meta.url));
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const document = new PDFDocument();
    document.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.image(image, 20, 20);
    document.end();
  });
}

function appendRecoverableNonImageParseError(pdf: Buffer) {
  const corruptObject = Buffer.from(
    "\n9 0 obj\n<< /Type /Annot /Rect [0 0 0 0] /Broken (unterminated string\nendobj\n",
    "latin1",
  );
  return Buffer.concat([pdf, corruptObject]);
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("PDF extraction budgets", () => {
  it("accepts exact aggregate boundaries and rejects the first byte or item beyond them", () => {
    const limits = {
      ...PDF_EXTRACTION_BUDGET,
      maxRenderPixels: 1,
      maxPages: 1,
      maxArtifacts: 1,
      maxArtifactBytes: 2,
      maxTextBytes: 2,
      maxResultBytes: 2,
    };
    const tracker = new PdfExtractionBudgetTracker(limits);
    tracker.addPage("é");
    tracker.addArtifact(2);
    tracker.assertResult("é");
    expect(() => tracker.addArtifact(1)).toThrow(/PDF_EXTRACTION_BUDGET_EXCEEDED/);
    expect(() => tracker.assertArtifact(3)).toThrow(/PDF_EXTRACTION_BUDGET_EXCEEDED/);
    expect(() => tracker.assertRenderDimensions(2, 2)).toThrow(/PDF_EXTRACTION_BUDGET_EXCEEDED/);

    expect(() => new PdfExtractionBudgetTracker({ ...limits, maxPages: 0 }).addPage("")).toThrow(
      /PDF_EXTRACTION_BUDGET_EXCEEDED/,
    );
    expect(() => new PdfExtractionBudgetTracker({ ...limits, maxTextBytes: 1 }).addPage("é")).toThrow(
      /PDF_EXTRACTION_BUDGET_EXCEEDED/,
    );
    expect(() => new PdfExtractionBudgetTracker({ ...limits, maxResultBytes: 1 }).assertResult("é")).toThrow(
      /PDF_EXTRACTION_BUDGET_EXCEEDED/,
    );
  });

  it("terminates the Python child tree when the total deadline expires", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "clinical-kb-pdf-deadline-"));
    roots.push(root);
    const inputPath = path.join(root, "child-pid-path.txt");
    const outputDir = path.join(root, "images");
    const fakeExtractor = path.join(root, "slow-extractor.py");
    const childPidPath = path.join(root, "child.pid");
    await mkdir(outputDir);
    await writeFile(inputPath, childPidPath, "utf8");
    await writeFile(
      fakeExtractor,
      [
        "import pathlib, subprocess, sys, time",
        "pid_path = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')",
        "child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])",
        "pathlib.Path(pid_path).write_text(str(child.pid), encoding='utf-8')",
        "while True: time.sleep(1)",
      ].join("\n"),
      "utf8",
    );

    await expect(
      runPythonPdfExtractor(inputPath, outputDir, { ...PDF_EXTRACTION_BUDGET, totalTimeoutMs: 1_000 }, fakeExtractor),
    ).rejects.toMatchObject({ code: "PDF_EXTRACTION_DEADLINE_EXCEEDED" });

    const childPid = Number(await readFile(childPidPath, "utf8"));
    let childIsAlive = false;
    try {
      process.kill(childPid, 0);
      childIsAlive = true;
    } catch {
      childIsAlive = false;
    }
    if (childIsAlive) process.kill(childPid, "SIGKILL");
    expect(childIsAlive).toBe(false);
  });

  it("classifies budget and deadline rejections as non-retryable", () => {
    expect(
      isRetryableIngestionError(new PdfExtractionResourceError("PDF_EXTRACTION_DEADLINE_EXCEEDED", "deadline timeout")),
    ).toBe(false);
    expect(
      isRetryableIngestionError(new PdfExtractionResourceError("PDF_EXTRACTION_BUDGET_EXCEEDED", "artifact budget")),
    ).toBe(false);
  });

  it("does not enter fallback and removes the temporary root after a budget rejection", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "clinical-kb-pdf-cleanup-test-"));
    roots.push(root);
    const fakeExtractor = path.join(root, "budget-extractor.py");
    const rootRecord = path.join(root, "temporary-root.txt");
    await writeFile(
      fakeExtractor,
      [
        "import pathlib, sys",
        "record = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')",
        "temporary_root = pathlib.Path(sys.argv[2]).parent",
        "pathlib.Path(record).write_text(str(temporary_root), encoding='utf-8')",
        "(temporary_root / 'partial-artifact.bin').write_bytes(b'partial')",
        "print('PDF_EXTRACTION_BUDGET_EXCEEDED: test limit', file=sys.stderr)",
        "raise SystemExit(3)",
      ].join("\n"),
      "utf8",
    );

    await expect(
      extractPdf(Buffer.from(rootRecord, "utf8"), { scriptPathOverride: fakeExtractor }),
    ).rejects.toMatchObject({ code: "PDF_EXTRACTION_BUDGET_EXCEEDED" });
    const temporaryRoot = await readFile(rootRecord, "utf8");
    expect(existsSync(temporaryRoot)).toBe(false);
  });

  it("applies the same aggregate text budget in the JavaScript fallback", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "clinical-kb-pdf-fallback-test-"));
    roots.push(root);
    const fakeExtractor = path.join(root, "missing-dependency.py");
    await writeFile(
      fakeExtractor,
      "import sys\nprint('PyMuPDF unavailable', file=sys.stderr)\nraise SystemExit(2)\n",
      "utf8",
    );

    await expect(
      extractPdf(await createTextPdf(), {
        limits: { ...PDF_EXTRACTION_BUDGET, maxTextBytes: 1 },
        scriptPathOverride: fakeExtractor,
      }),
    ).rejects.toMatchObject({ code: "PDF_EXTRACTION_BUDGET_EXCEEDED" });
  });

  it("rejects an oversized embedded image before the JavaScript fallback decodes it", async () => {
    const getTextSpy = vi.spyOn(PDFParse.prototype, "getText");
    const getImageSpy = vi.spyOn(PDFParse.prototype, "getImage");
    const root = await mkdtemp(path.join(tmpdir(), "clinical-kb-pdf-image-budget-test-"));
    roots.push(root);
    const fakeExtractor = path.join(root, "missing-dependency.py");
    await writeFile(
      fakeExtractor,
      "import sys\nprint('PyMuPDF unavailable', file=sys.stderr)\nraise SystemExit(2)\n",
      "utf8",
    );

    await expect(
      extractPdf(await createImagePdf(), {
        limits: { ...PDF_EXTRACTION_BUDGET, maxRenderPixels: 1 },
        scriptPathOverride: fakeExtractor,
      }),
    ).rejects.toMatchObject({ code: "PDF_EXTRACTION_BUDGET_EXCEEDED" });

    expect(getTextSpy).not.toHaveBeenCalled();
    expect(getImageSpy).not.toHaveBeenCalled();
  });

  it("still extracts text from a malformed-but-readable PDF without stopAtErrors on text parsing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "clinical-kb-pdf-recoverable-error-test-"));
    roots.push(root);
    const fakeExtractor = path.join(root, "missing-dependency.py");
    await writeFile(
      fakeExtractor,
      "import sys\nprint('PyMuPDF unavailable', file=sys.stderr)\nraise SystemExit(2)\n",
      "utf8",
    );

    const extracted = await extractPdf(appendRecoverableNonImageParseError(await createTextPdf()), {
      scriptPathOverride: fakeExtractor,
    });

    expect(extracted.pages.some((page) => page.text.includes("deliberately longer than one byte"))).toBe(true);
  });
});
