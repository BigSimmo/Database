/**
 * run-legacy — single-document legacy-extractor runner for the Docling lab.
 *
 * Read-only consumer of `extractDocument` (src/lib/extractors/document.ts), the
 * comparator README §B3 names; nothing under src/ or worker/ is modified. Invoked
 * per fixture by harness/run_corpus.py so wall-clock limits and peak-RSS
 * measurement live in one place for both engines:
 *
 *   node scripts/run-tsx.mjs eval/docling/harness/run-legacy.ts --file <pdf> --result <json>
 *
 * The result file is raw per-document material for harness/score.py only — it may
 * carry extracted text, so it stays under the run's out/raw/ directory and is never
 * uploaded or reported (the aggregate report is built through lab-contract.mjs's
 * numeric allowlist).
 */
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { extractDocument } from "../../../src/lib/extractors/document";
import type { ExtractedDocument, ExtractedImage } from "../../../src/lib/types";

const TEXT_CAP_BYTES = Number(process.env.LAB_PER_DOC_TEXT_BYTES ?? 64 * 1024 * 1024);

type LegacyTable = {
  markdown: string | null;
  rows: number | null;
  cols: number | null;
};

function tableFromImage(image: ExtractedImage): LegacyTable | null {
  if (image.sourceKind !== "table_crop") return null;
  const metadata = image.metadata ?? {};
  const markdown = metadata["accessible_table_markdown"];
  const rows = metadata["table_rows"];
  const cols = metadata["table_columns"];
  return {
    markdown: typeof markdown === "string" ? markdown : null,
    rows: typeof rows === "number" ? rows : null,
    cols: typeof cols === "number" ? cols : null,
  };
}

function argValue(flag: string): string {
  const index = process.argv.indexOf(flag);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value) {
    console.error(`run-legacy: missing required argument ${flag}`);
    process.exit(2);
  }
  return value;
}

async function main(): Promise<void> {
  const filePath = argValue("--file");
  const resultPath = argValue("--result");
  const fileName = path.basename(filePath);
  const buffer = await readFile(filePath);

  try {
    // The per-format extractors return narrower literal shapes; widen to the
    // published contract type so the optional fields are addressable.
    const extracted: ExtractedDocument = await extractDocument({ buffer, fileName, mimeType: "application/pdf" });
    const text = extracted.pages.map((page) => page.text).join("\n");
    const tables = extracted.images.map(tableFromImage).filter((table): table is LegacyTable => table !== null);
    await writeFile(
      resultPath,
      JSON.stringify({
        engine: "legacy",
        ok: true,
        fileName,
        pages: extracted.pages.length,
        ocrPages: extracted.pages.filter((page) => page.ocrUsed).length,
        needsOcrPages: extracted.pages.filter((page) => page.needsOcr).length,
        textChars: text.length,
        text: Buffer.byteLength(text, "utf8") > TEXT_CAP_BYTES ? text.slice(0, TEXT_CAP_BYTES) : text,
        tables,
        warnings: extracted.warnings ?? [],
        budgetUsage: extracted.budgetUsage ?? null,
      }),
    );
    if (extracted.temporaryPaths) {
      await Promise.all(
        extracted.temporaryPaths.map((temporaryPath) => rm(temporaryPath, { recursive: true, force: true })),
      );
    }
  } catch (error) {
    // A clean failure is a legitimate benchmark outcome (the hostile corpus exists to
    // provoke it); record it and exit 10 so the driver can tell failure from crash.
    const name = error instanceof Error ? error.name : "UnknownError";
    const message = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
    await writeFile(resultPath, JSON.stringify({ engine: "legacy", ok: false, fileName, error: { name, message } }));
    process.exit(10);
  }
}

main().catch((error) => {
  console.error("run-legacy: unhandled failure");
  console.error(error);
  process.exit(1);
});
