import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { extractDocument } from "@/lib/extractors/document";
import { XlsxExtractionBudgetTracker, type XlsxExtractionBudget } from "@/lib/extractors/xlsx-extraction-budget";

const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function buildXlsx(sheetCount: number) {
  const workbook = new ExcelJS.Workbook();
  for (let index = 0; index < sheetCount; index += 1) {
    workbook.addWorksheet(`Sheet ${index + 1}`).addRow(["value"]);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("XLSX extraction budgets", () => {
  const limits: XlsxExtractionBudget = {
    maxSheets: 2,
    maxRows: 2,
    maxCells: 3,
    maxTextBytes: 4,
  };

  it("enforces worksheet, row, and rendered-cell boundaries", () => {
    const sheets = new XlsxExtractionBudgetTracker(limits);
    expect(() => sheets.assertSheetCount(2)).not.toThrow();
    expect(() => sheets.assertSheetCount(3)).toThrow("XLSX_EXTRACTION_BUDGET_EXCEEDED: worksheet count 3 exceeds 2");

    const rows = new XlsxExtractionBudgetTracker(limits);
    rows.addRow(2);
    rows.addRow(1);
    expect(() => rows.addRow(0)).toThrow("XLSX_EXTRACTION_BUDGET_EXCEEDED: row count exceeds 2");

    const cells = new XlsxExtractionBudgetTracker(limits);
    cells.addRow(3);
    expect(() => cells.addRow(1)).toThrow("XLSX_EXTRACTION_BUDGET_EXCEEDED: cell count exceeds 3");
  });

  it("measures aggregate output as UTF-8 bytes", () => {
    const budget = new XlsxExtractionBudgetTracker(limits);
    budget.addText("éé");
    expect(() => budget.addText("a")).toThrow("XLSX_EXTRACTION_BUDGET_EXCEEDED: extracted UTF-8 text exceeds 4 bytes");
  });

  it("preserves sparse-column output within the budget", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sparse");
    sheet.getCell("C1").value = "value";

    const result = await extractDocument({
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      fileName: "sparse.xlsx",
      mimeType: xlsxMime,
    });

    expect(result.pages).toEqual([{ pageNumber: 1, text: "Sheet: Sparse\n,,value", ocrUsed: false }]);
  });

  it("rejects workbooks with excessive worksheet counts", async () => {
    await expect(
      extractDocument({ buffer: await buildXlsx(257), fileName: "sheet-heavy.xlsx", mimeType: xlsxMime }),
    ).rejects.toThrow("XLSX_EXTRACTION_BUDGET_EXCEEDED: worksheet count 257 exceeds 256");
  });
});
