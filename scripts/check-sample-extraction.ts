import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractDocument } from "../src/lib/extractors/document";

const files = [
  ["synthetic-lithium-monitoring.pdf", "application/pdf"],
  ["synthetic-clozapine-monitoring-with-image.pdf", "application/pdf"],
  ["synthetic-risk-flow-with-image.pdf", "application/pdf"],
  ["synthetic-scanned-lithium-safety-net.pdf", "application/pdf"],
  ["synthetic-adhd-shared-care.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["synthetic-metabolic-monitoring.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["synthetic-perinatal-prescribing-note.txt", "text/plain"],
] as const;

async function main() {
  const base = path.join(process.cwd(), "sample-documents");
  for (const [fileName, mimeType] of files) {
    const buffer = await readFile(path.join(base, fileName));
    const extracted = await extractDocument({ buffer, fileName, mimeType });
    const textLength = extracted.pages.reduce((sum, page) => sum + page.text.length, 0);
    console.log(
      `${fileName}: pages=${extracted.pages.length} images=${extracted.images.length} textChars=${textLength} ocrPages=${extracted.pages.filter((page) => page.ocrUsed).length}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
