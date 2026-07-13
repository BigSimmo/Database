import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import JSZip from "jszip";
import { safeBufferFrom } from "@/lib/safe-buffer";
import { z } from "zod";
import type { ExtractedDocument, ExtractedPage } from "@/lib/types";

const extractedPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string(),
  ocrUsed: z.boolean().optional(),
  needsOcr: z.boolean().optional(),
});

const extractedImageSchema = z.object({
  pageNumber: z.number().int().positive().nullable(),
  path: z.string().min(1),
  mimeType: z.string().min(1),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  sourceKind: z.enum(["embedded", "table_crop", "diagram_crop", "page_region", "fallback", "cover_page"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const extractedDocumentSchema = z.object({
  pages: z.array(extractedPageSchema),
  images: z.array(extractedImageSchema),
  warnings: z.array(z.string()).optional(),
  temporaryPaths: z.array(z.string()).optional(),
});

export function parseExtractedDocumentPayload(raw: string): ExtractedDocument {
  return extractedDocumentSchema.parse(JSON.parse(raw));
}

function runPythonPdfExtractor(filePath: string, outputDir: string) {
  const scriptPath = path.join(process.cwd(), "worker", "python", "extract_pdf_assets.py");
  const outputJsonPath = path.join(outputDir, "extract.json");

  return new Promise<ExtractedDocument>((resolve, reject) => {
    const child = spawn(process.env.PYTHON_BIN || "python", [scriptPath, filePath, outputDir, outputJsonPath], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `PDF extractor exited with code ${code}`));
        return;
      }

      try {
        const jsonPayload = await readFile(outputJsonPath, "utf8").catch(() => extractJsonFromStdout(stdout));
        resolve(parseExtractedDocumentPayload(jsonPayload));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function extractJsonFromStdout(stdout: string) {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return stdout;
  return stdout.slice(start, end + 1);
}

async function extractPdf(buffer: Buffer) {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "clinical-kb-"));
  const pdfPath = path.join(tempRoot, "document.pdf");
  const imageDir = path.join(tempRoot, "images");
  await mkdir(imageDir, { recursive: true });
  await writeFile(pdfPath, buffer);

  try {
    const extracted = await runPythonPdfExtractor(pdfPath, imageDir);
    return { ...extracted, temporaryPaths: [tempRoot] };
  } catch {
    // Fallback for developer machines without PyMuPDF/pytesseract. It still
    // indexes text PDFs, but scanned PDFs and image extraction need the Python
    // helper dependencies listed in worker/python/requirements.txt.
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      const imageResult = await parser.getImage({
        imageBuffer: true,
        imageDataUrl: true,
        imageThreshold: 20,
      });
      const images: ExtractedDocument["images"] = [];
      for (const page of imageResult.pages) {
        for (const [index, image] of page.images.entries()) {
          const dataUrlMatch = image.dataUrl?.match(/^data:(.*?);base64,(.*)$/);
          const mimeType = dataUrlMatch?.[1] ?? "image/png";
          const extension = mimeType.includes("jpeg") ? "jpg" : "png";
          const outputPath = path.join(imageDir, `fallback-page-${page.pageNumber}-image-${index + 1}.${extension}`);
          const bytes = dataUrlMatch ? safeBufferFrom(dataUrlMatch[2], "base64") : Buffer.from(image.data);
          if (!bytes) continue;
          await writeFile(outputPath, bytes);
          images.push({
            pageNumber: page.pageNumber,
            path: outputPath,
            mimeType,
            bbox: null,
            width: null,
            height: null,
            sourceKind: "fallback",
            metadata: { source_kind: "fallback" },
          });
        }
      }
      await parser.destroy();

      // IDX-H3: the JS fallback cannot OCR. A scanned / image-only page yields little or no
      // embedded text, so without flagging it the document would index as near-empty yet still
      // be marked "indexed" — invisible to retrieval. Mark any page that has image content but
      // below-threshold text as needsOcr so index_quality surfaces it (and the worker refuses
      // to mark an image-only PDF as fully indexed).
      const JS_FALLBACK_MIN_TEXT_CHARS = 40;
      const imageCountByPage = new Map<number, number>();
      for (const image of images) {
        if (image.pageNumber === null) continue;
        imageCountByPage.set(image.pageNumber, (imageCountByPage.get(image.pageNumber) ?? 0) + 1);
      }

      const rawPages: ExtractedPage[] =
        parsed.pages.length > 0
          ? parsed.pages.map((page: { num: number; text?: string }) => ({
              pageNumber: page.num,
              text: page.text || "",
              ocrUsed: false,
            }))
          : [{ pageNumber: 1, text: parsed.text || "", ocrUsed: false }];

      const pages: ExtractedPage[] = rawPages.map((page) => {
        const textLength = page.text.trim().length;
        const hasImages = (imageCountByPage.get(page.pageNumber) ?? 0) > 0;
        const needsOcr = textLength < JS_FALLBACK_MIN_TEXT_CHARS && hasImages;
        return { pageNumber: page.pageNumber, text: page.text, ocrUsed: false, needsOcr };
      });

      const warnings = ["Used JavaScript PDF fallback; install Python PDF/OCR prerequisites for scanned PDFs."];
      const ocrNeededPages = pages.filter((page) => page.needsOcr).length;
      if (ocrNeededPages > 0) {
        warnings.push(`needs_ocr: ${ocrNeededPages} page(s) appear image-only and were not OCR'd by the JS fallback.`);
      }

      return { pages, images, warnings, temporaryPaths: [tempRoot] };
    } catch (fallbackError) {
      await parser.destroy().catch(() => undefined);
      await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
      throw fallbackError;
    }
  }
}

async function extractDocx(buffer: Buffer) {
  const raw = await mammoth.extractRawText({ buffer });
  const zip = await JSZip.loadAsync(buffer);
  const tempRoot = await mkdtemp(path.join(tmpdir(), "clinical-kb-docx-"));
  const images: ExtractedDocument["images"] = [];

  try {
    const media = Object.keys(zip.files).filter((name) => name.startsWith("word/media/"));
    for (const [index, name] of media.entries()) {
      const file = zip.files[name];
      if (file.dir) continue;
      const bytes = await file.async("nodebuffer");
      const ext = path.extname(name).toLowerCase() || ".png";
      // Map the actual media extension to its real MIME type. Previously every
      // non-jpg/webp extension (including .emf/.wmf/.tiff/.bmp/.gif vector and
      // legacy-raster figures common in clinical .docx) was mislabeled image/png,
      // which was then written to storage/DB and sent to the vision API as PNG.
      const docxImageMimeByExt: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".tif": "image/tiff",
        ".tiff": "image/tiff",
        ".emf": "image/emf",
        ".wmf": "image/wmf",
        ".svg": "image/svg+xml",
      };
      const mimeType = docxImageMimeByExt[ext] ?? "application/octet-stream";
      const outputPath = path.join(tempRoot, `docx-image-${index}${ext}`);
      await writeFile(outputPath, bytes);
      images.push({
        pageNumber: null,
        path: outputPath,
        mimeType,
        bbox: null,
        width: null,
        height: null,
        sourceKind: "embedded",
        metadata: { source_kind: "docx_media", file_name: name },
      });
    }

    return {
      pages: [{ pageNumber: 1, text: raw.value || "", ocrUsed: false }],
      images,
      temporaryPaths: [tempRoot],
    } satisfies ExtractedDocument;
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function extractXlsx(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const pages = workbook.worksheets.map((sheet, index) => {
    const rows: string[] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map((value) => String(value ?? "")).join(","));
    });
    return {
      pageNumber: index + 1,
      text: `Sheet: ${sheet.name}\n${rows.join("\n")}`,
      ocrUsed: false,
    };
  });

  return { pages, images: [] } satisfies ExtractedDocument;
}

export async function assertOoxmlArchiveBudget(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files);
  if (entries.length > 10_000) throw new Error("OOXML archive contains too many entries.");
  const expandedBytes = entries.reduce((total, file) => {
    const data = (file as unknown as { _data?: { uncompressedSize?: number } })._data;
    return total + Math.max(0, Number(data?.uncompressedSize ?? 0));
  }, 0);
  const maxExpandedBytes = 512 * 1024 * 1024;
  const maxRatioBytes = Math.max(buffer.byteLength * 100, 16 * 1024 * 1024);
  if (expandedBytes > maxExpandedBytes || expandedBytes > maxRatioBytes) {
    throw new Error("OOXML archive exceeds the safe expanded-size budget.");
  }
}

function extractTxt(buffer: Buffer) {
  return {
    pages: [{ pageNumber: 1, text: buffer.toString("utf8"), ocrUsed: false }],
    images: [],
  } satisfies ExtractedDocument;
}

export async function extractDocument(args: { buffer: Buffer; fileName: string; mimeType: string }) {
  if (args.mimeType === "application/pdf" || args.fileName.toLowerCase().endsWith(".pdf")) {
    return extractPdf(args.buffer);
  }

  if (
    args.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    args.fileName.toLowerCase().endsWith(".docx")
  ) {
    await assertOoxmlArchiveBudget(args.buffer);
    return extractDocx(args.buffer);
  }

  if (
    args.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    args.fileName.toLowerCase().endsWith(".xlsx")
  ) {
    await assertOoxmlArchiveBudget(args.buffer);
    return extractXlsx(args.buffer);
  }

  return extractTxt(args.buffer);
}

export async function fileToBase64(filePath: string) {
  return (await readFile(filePath)).toString("base64");
}
