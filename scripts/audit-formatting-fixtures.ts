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

async function auditExtractJson(file: string): Promise<FormattingIssue[]> {
  const raw = await readFile(file, "utf8");
  const payload = JSON.parse(raw) as {
    images?: Array<Record<string, unknown>>;
    pages?: Array<Record<string, unknown>>;
  };
  const issues: FormattingIssue[] = [];
  const images = payload.images ?? [];
  const pages = payload.pages ?? [];

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

  return issues;
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.log("Usage: npm run audit:formatting-fixtures -- artifacts/extract.json [...]");
    return;
  }
  const issues: FormattingIssue[] = [];
  for (const file of files) {
    const absolute = path.resolve(file);
    await stat(absolute);
    issues.push(...(await auditExtractJson(absolute)));
  }
  console.log(`Formatting fixture audit: ${files.length} file(s), ${issues.length} issue(s)`);
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
