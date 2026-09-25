import { readFile, stat } from "node:fs/promises";
import path from "node:path";

type FormattingIssue = {
  file: string;
  issue: string;
  severity: "warning" | "fail";
};

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function metadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export type ExtractPayload = {
  images: Array<Record<string, unknown>>;
  pages: Array<Record<string, unknown>>;
};

export class ExtractShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractShapeError";
  }
}

/**
 * Read `images` and `pages` out of an extractor payload, or refuse.
 *
 * WHAT THIS PREVENTS. `payload.images ?? []` turns "this key is missing" into
 * "there is nothing here", and those are opposite findings: the first means the
 * audit cannot see the file, the second means the file is clean. Both used to
 * print `0 issue(s)` and exit 0. The same substitution is what let the source
 * governance audit report success over 835 catalogue records it never loaded
 * (#229), and what let its reviewer gate pass over 1,935 documents it never
 * examined — so it is refused here rather than repeated a third time.
 *
 * A payload carrying neither key is not an extract file. A payload carrying one
 * of them as a non-array has a shape this audit does not understand. Both raise;
 * neither is silently empty. A key that is genuinely absent while the other is
 * present is accepted as empty, because an extract with images and no pages is a
 * real thing.
 */
export function parseExtractPayload(value: unknown, file: string): ExtractPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ExtractShapeError(`${file}: not a JSON object, so the formatting audit cannot read it.`);
  }
  const payload = value as Record<string, unknown>;
  const hasImages = payload.images !== undefined && payload.images !== null;
  const hasPages = payload.pages !== undefined && payload.pages !== null;
  if (!hasImages && !hasPages) {
    throw new ExtractShapeError(
      `${file}: carries neither "images" nor "pages", so it is not an extractor payload this audit can check. ` +
        `Keys present: ${Object.keys(payload).join(", ") || "(none)"}.`,
    );
  }
  if (hasImages && !Array.isArray(payload.images)) {
    throw new ExtractShapeError(`${file}: "images" is present but is not an array (${typeof payload.images}).`);
  }
  if (hasPages && !Array.isArray(payload.pages)) {
    throw new ExtractShapeError(`${file}: "pages" is present but is not an array (${typeof payload.pages}).`);
  }
  return {
    images: (hasImages ? (payload.images as Array<Record<string, unknown>>) : []) ?? [],
    pages: (hasPages ? (payload.pages as Array<Record<string, unknown>>) : []) ?? [],
  };
}

async function auditExtractJson(file: string): Promise<{ issues: FormattingIssue[]; images: number; pages: number }> {
  const raw = await readFile(file, "utf8");
  const { images, pages } = parseExtractPayload(JSON.parse(raw), file);
  const issues: FormattingIssue[] = [];

  for (const [index, image] of images.entries()) {
    const meta = metadata(image.metadata);
    const label = `${file}#image-${index + 1}`;
    const sourceKind = String(image.sourceKind ?? image.source_kind ?? "");
    const width = numberValue(image.width);
    const height = numberValue(image.height);
    const cropCompleteness = numberValue(meta.crop_completeness);
    const structuredConfidence = numberValue(meta.structured_extraction_confidence);
    const ocrDensity = numberValue(meta.ocr_text_density);

    if (sourceKind === "table_crop" && !Array.isArray(meta.table_rows)) {
      issues.push({ file: label, severity: "fail", issue: "table crop missing structured table rows" });
    }
    if (meta.rows_truncated === true) {
      issues.push({ file: label, severity: "warning", issue: "table rows truncated" });
    }
    if (cropCompleteness !== null && cropCompleteness < 0.82) {
      issues.push({ file: label, severity: "warning", issue: `crop cut-off risk (${cropCompleteness})` });
    }
    if (structuredConfidence !== null && structuredConfidence < 0.58) {
      issues.push({ file: label, severity: "warning", issue: `low structured confidence (${structuredConfidence})` });
    }
    if (ocrDensity !== null && ocrDensity < 0.18) {
      issues.push({ file: label, severity: "warning", issue: `low OCR text density (${ocrDensity})` });
    }
    if (width && height) {
      const ratio = width / height;
      if (ratio > 4 || ratio < 0.45) {
        issues.push({ file: label, severity: "warning", issue: `extreme image aspect ratio (${ratio.toFixed(2)})` });
      }
    }
  }

  for (const page of pages) {
    if (page.needsOcr === true) {
      issues.push({
        file: `${file}#page-${String(page.pageNumber ?? "?")}`,
        severity: "fail",
        issue: "page needs OCR but OCR text was unavailable",
      });
    }
  }

  return { issues, images: images.length, pages: pages.length };
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.log("Usage: npm run audit:formatting-fixtures -- artifacts/extract.json [...]");
    return;
  }
  const issues: FormattingIssue[] = [];
  let imagesExamined = 0;
  let pagesExamined = 0;
  for (const file of files) {
    const absolute = path.resolve(file);
    await stat(absolute);
    const result = await auditExtractJson(absolute);
    issues.push(...result.issues);
    imagesExamined += result.images;
    pagesExamined += result.pages;
  }
  // The counts are part of the verdict, not decoration: "0 issue(s)" over 0
  // images and 0 pages is an audit that saw nothing, and it must not read the
  // same as a clean one.
  console.log(
    `Formatting fixture audit: ${files.length} file(s), ${imagesExamined} image(s), ${pagesExamined} page(s), ${issues.length} issue(s)`,
  );
  for (const issue of issues) {
    console.log(`${issue.severity.toUpperCase()} ${issue.file}: ${issue.issue}`);
  }
  if (issues.some((issue) => issue.severity === "fail")) {
    throw new Error("Formatting fixture audit found failing issues.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
