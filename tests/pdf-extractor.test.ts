import { spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import PDFDocument from "pdfkit";
import { describe, expect, it } from "vitest";

import { resolvePythonBin } from "@/lib/python-bin";
import { extractPdf } from "@/lib/extractors/document";

const pythonBin = resolvePythonBin();
const hasPyMuPDF = spawnSync(pythonBin, ["-c", "import fitz"], { encoding: "utf8" }).status === 0;

describe("Python PDF extraction prerequisite", () => {
  it.runIf(Boolean(process.env.CI))("is installed in CI so extraction coverage cannot silently skip", () => {
    expect(hasPyMuPDF).toBe(true);
  });
});

async function writeSyntheticTablePdf(filePath: string) {
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = createWriteStream(filePath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.pipe(stream);

    doc.fontSize(12).text("Table 1: Agitation and arousal rating scale and associated management", 50, 64);
    const x = 50;
    const y = 92;
    const widths = [70, 190, 250];
    const rowHeight = 34;
    const rows = [
      ["Score", "Patient's state", "Management"],
      ["0", "Asleep or unconscious", "Review prescribed doses and conduct required monitoring."],
      ["5", "Highly aroused and violent", "Use emergency escalation and record observations."],
    ];

    let currentY = y;
    for (const row of rows) {
      let currentX = x;
      for (let index = 0; index < row.length; index += 1) {
        doc.rect(currentX, currentY, widths[index], rowHeight).stroke();
        doc.fontSize(index === 0 ? 8 : 7).text(row[index], currentX + 4, currentY + 6, {
          width: widths[index] - 8,
          height: rowHeight - 8,
        });
        currentX += widths[index];
      }
      currentY += rowHeight;
    }

    doc.end();
  });
}

async function writeSyntheticAdminTablePdf(filePath: string) {
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = createWriteStream(filePath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.pipe(stream);

    doc.fontSize(12).text("13. Authorisation", 50, 64);
    const x = 50;
    const y = 92;
    const widths = [160, 340];
    const rowHeight = 30;
    const rows = [
      ["Authorisation date", "Published date"],
      ["01/01/2026", "02/01/2026"],
      ["Document owner", "Mental Health Service"],
    ];

    let currentY = y;
    for (const row of rows) {
      let currentX = x;
      for (let index = 0; index < row.length; index += 1) {
        doc.rect(currentX, currentY, widths[index], rowHeight).stroke();
        doc.fontSize(8).text(row[index], currentX + 4, currentY + 7, {
          width: widths[index] - 8,
          height: rowHeight - 8,
        });
        currentX += widths[index];
      }
      currentY += rowHeight;
    }

    doc.end();
  });
}

describe.runIf(hasPyMuPDF)("Python PDF table extraction", () => {
  it("writes clean JSON to a file and emits clinical table crops with titles", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "clinical-kb-extractor-test-"));
    const pdfPath = path.join(root, "table.pdf");
    const imageDir = path.join(root, "images");
    const jsonPath = path.join(root, "extract.json");
    await mkdir(imageDir, { recursive: true });
    await writeSyntheticTablePdf(pdfPath);

    const result = spawnSync(
      pythonBin,
      [path.join(process.cwd(), "worker", "python", "extract_pdf_assets.py"), pdfPath, imageDir, jsonPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(await readFile(jsonPath, "utf8")) as {
      images: Array<{ sourceKind?: string; metadata?: Record<string, unknown> }>;
    };
    const tableCrop = payload.images.find((image) => image.sourceKind === "table_crop");
    expect(tableCrop).toBeTruthy();
    expect(tableCrop?.metadata?.table_title).toContain("Agitation and arousal");
    expect(tableCrop?.metadata?.table_text).toContain("Management");
    expect(tableCrop?.metadata?.table_role).toBe("clinical");
    expect(Number(tableCrop?.metadata?.table_confidence)).toBeGreaterThan(0.5);
    expect(tableCrop?.metadata?.accessible_table_markdown).toContain("Score");
    expect(tableCrop?.metadata?.table_columns).toEqual(["Score", "Patient's state", "Management"]);
    expect(tableCrop?.metadata?.clip_bbox).toEqual(expect.any(Array));
    expect(tableCrop?.metadata?.render_dpi).toEqual(expect.any(Number));
    expect(tableCrop?.metadata?.page_width).toEqual(expect.any(Number));
    expect(tableCrop?.metadata?.page_rotation).toEqual(expect.any(Number));
    expect(tableCrop?.metadata?.source_regions).toEqual(
      expect.arrayContaining([expect.objectContaining({ source_kind: "table_crop", page_number: 1 })]),
    );
    expect(tableCrop?.metadata?.table_rows).toEqual(
      expect.arrayContaining([expect.arrayContaining(["5", "Highly aroused and violent"])]),
    );
  });

  it("retains real administrative tables with a non-clinical role for document review", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "clinical-kb-extractor-test-"));
    const pdfPath = path.join(root, "admin-table.pdf");
    const imageDir = path.join(root, "images");
    const jsonPath = path.join(root, "extract.json");
    await mkdir(imageDir, { recursive: true });
    await writeSyntheticAdminTablePdf(pdfPath);

    const result = spawnSync(
      pythonBin,
      [path.join(process.cwd(), "worker", "python", "extract_pdf_assets.py"), pdfPath, imageDir, jsonPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(await readFile(jsonPath, "utf8")) as {
      images: Array<{ sourceKind?: string; metadata?: Record<string, unknown> }>;
    };
    const tableCrop = payload.images.find((image) => image.sourceKind === "table_crop");
    expect(tableCrop).toBeTruthy();
    expect(tableCrop?.metadata?.table_text).toContain("Authorisation date");
    expect(tableCrop?.metadata?.table_role).toBe("admin");
    expect(tableCrop?.metadata?.accessible_table_markdown).toContain("Published date");
  });
});

describe.runIf(hasPyMuPDF)("Python extractor fallback", () => {
  it("rejects cleanly if the python process dies with SIGKILL", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "clinical-kb-extractor-test-"));
    const pdfPath = path.join(root, "table.pdf");
    const scriptPath = path.join(root, "kill_self.py");
    
    await mkdir(root, { recursive: true });
    await writeSyntheticTablePdf(pdfPath);
    
    // Write a python script that sends SIGKILL to itself immediately
    await require("node:fs/promises").writeFile(
      scriptPath,
      "import os, signal\nos.kill(os.getpid(), signal.SIGKILL)\n"
    );

    const pdfBuffer = await readFile(pdfPath);
    
    await expect(
      extractPdf(pdfBuffer, { scriptPathOverride: scriptPath })
    ).rejects.toThrow(/PDF extractor exited with code/);
  });
});
