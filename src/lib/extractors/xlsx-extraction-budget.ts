export const XLSX_EXTRACTION_BUDGET = {
  maxSheets: 256,
  maxRows: 200_000,
  maxCells: 2_000_000,
  maxTextBytes: 32 * 1024 * 1024,
} as const;

export type XlsxExtractionBudget = {
  maxSheets: number;
  maxRows: number;
  maxCells: number;
  maxTextBytes: number;
};

function budgetExceeded(message: string): never {
  throw new Error(`XLSX_EXTRACTION_BUDGET_EXCEEDED: ${message}`);
}

function nonNegativeCount(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    budgetExceeded(`invalid ${label} ${value}`);
  }
  return value;
}

export class XlsxExtractionBudgetTracker {
  private rowCount = 0;
  private cellCount = 0;
  private textBytes = 0;

  constructor(readonly limits: XlsxExtractionBudget = XLSX_EXTRACTION_BUDGET) {}

  assertSheetCount(sheetCount: number) {
    const safeSheetCount = nonNegativeCount(sheetCount, "worksheet count");
    if (safeSheetCount > this.limits.maxSheets) {
      budgetExceeded(`worksheet count ${safeSheetCount} exceeds ${this.limits.maxSheets}`);
    }
  }

  addRow(cellCount: number) {
    const safeCellCount = nonNegativeCount(cellCount, "cell count");
    const nextRowCount = this.rowCount + 1;
    if (!Number.isSafeInteger(nextRowCount) || nextRowCount > this.limits.maxRows) {
      budgetExceeded(`row count exceeds ${this.limits.maxRows}`);
    }
    const nextCellCount = this.cellCount + safeCellCount;
    if (!Number.isSafeInteger(nextCellCount) || nextCellCount > this.limits.maxCells) {
      budgetExceeded(`cell count exceeds ${this.limits.maxCells}`);
    }
    this.rowCount = nextRowCount;
    this.cellCount = nextCellCount;
  }

  addText(text: string) {
    const nextTextBytes = this.textBytes + Buffer.byteLength(text, "utf8");
    if (!Number.isSafeInteger(nextTextBytes) || nextTextBytes > this.limits.maxTextBytes) {
      budgetExceeded(`extracted UTF-8 text exceeds ${this.limits.maxTextBytes} bytes`);
    }
    this.textBytes = nextTextBytes;
  }
}
