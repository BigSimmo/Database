import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import JSZip from "jszip";
import type { ExtractedDocument } from "@/lib/types";

function runPythonPdfExtractor(filePath: string, outputDir: string) {
  const scriptPath = path.join(process.cwd(), "worker", "python", "extract_pdf_assets.py");

  return new Promise<ExtractedDocument>((resolve, reject) => {
    const child = spawn(process.env.PYTHON_BIN || "python", [scriptPath, filePath, outputDir], {
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
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `PDF extractor exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout) as ExtractedDocument);
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function extractPdf(buffer: Buffer) {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "clinical-kb-"));
  const pdfPath = path.join(tempRoot, "document.pdf");
  const imageDir = path.join(tempRoot, "images");
  await mkdir(imageDir, { recursive: true });
  await writeFile(pdfPath, buffer);

  try {
    return await runPythonPdfExtractor(pdfPath, imageDir);
  } catch {
    // Fallback for developer machines without PyMuPDF/pytesseract. It still
    // indexes text PDFs, but scanned PDFs and image extraction need the Python
    // helper dependencies listed in worker/python/requirements.txt.
    const parser = new PDFParse({ data: buffer });
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
        const outputPath = path.join(
          imageDir,
          `fallback-page-${page.pageNumber}-image-${index + 1}.${extension}`,
        );
        const bytes = dataUrlMatch
          ? Buffer.from(dataUrlMatch[2], "base64")
          : Buffer.from(image.data);
        await writeFile(outputPath, bytes);
        images.push({
          pageNumber: page.pageNumber,
          path: outputPath,
          mimeType,
          bbox: null,
        });
      }
    }
    await parser.destroy();
    return {
      pages:
        parsed.pages.length > 0
          ? parsed.pages.map((page) => ({
              pageNumber: page.num,
              text: page.text || "",
              ocrUsed: false,
            }))
          : [{ pageNumber: 1, text: parsed.text || "", ocrUsed: false }],
      images,
    };
  }
}

async function extractDocx(buffer: Buffer) {
  const raw = await mammoth.extractRawText({ buffer });
  const zip = await JSZip.loadAsync(buffer);
  const tempRoot = await mkdtemp(path.join(tmpdir(), "clinical-kb-docx-"));
  const images: ExtractedDocument["images"] = [];

  const media = Object.keys(zip.files).filter((name) => name.startsWith("word/media/"));
  for (const [index, name] of media.entries()) {
    const file = zip.files[name];
    if (file.dir) continue;
    const bytes = await file.async("nodebuffer");
    const ext = path.extname(name).toLowerCase() || ".png";
    const mimeType =
      ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".webp"
          ? "image/webp"
          : "image/png";
    const outputPath = path.join(tempRoot, `docx-image-${index}${ext}`);
    await writeFile(outputPath, bytes);
    images.push({ pageNumber: null, path: outputPath, mimeType, bbox: null });
  }

  return {
    pages: [{ pageNumber: 1, text: raw.value || "", ocrUsed: false }],
    images,
  } satisfies ExtractedDocument;
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

function extractTxt(buffer: Buffer) {
  return {
    pages: [{ pageNumber: 1, text: buffer.toString("utf8"), ocrUsed: false }],
    images: [],
  } satisfies ExtractedDocument;
}

export async function extractDocument(args: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}) {
  if (args.mimeType === "application/pdf" || args.fileName.toLowerCase().endsWith(".pdf")) {
    return extractPdf(args.buffer);
  }

  if (
    args.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    args.fileName.toLowerCase().endsWith(".docx")
  ) {
    return extractDocx(args.buffer);
  }

  if (
    args.mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    args.fileName.toLowerCase().endsWith(".xlsx")
  ) {
    return extractXlsx(args.buffer);
  }

  return extractTxt(args.buffer);
}

export async function fileToBase64(filePath: string) {
  return (await readFile(filePath)).toString("base64");
}
