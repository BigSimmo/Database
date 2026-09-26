import ExcelJS from "exceljs";

/*
 * Invented rosters for tests. Every name is made up, and the hospital is
 * "Example Hospital". One table feeds every format, so the readers can be
 * checked against the same expected shifts.
 */

export const SAMPLE_ROSTER = {
  title: "Example Hospital General Medicine October roster",
  header: ["Name", "Grade", "Thu 1/10", "Fri 2/10", "Sat 3/10", "Sun 4/10"],
  rows: [
    ["Dr Alex Example", "Registrar", "D", "E", "N", "OFF"],
    ["Sam Sample", "Resident", "N", "N", "", "ADO"],
    ["Jo Placeholder", "Intern", "0800-1630", "D", "D", "D"],
  ],
} as const;

export function sampleRosterCsv(): string {
  return [SAMPLE_ROSTER.header, ...SAMPLE_ROSTER.rows].map((row) => row.join(",")).join("\n");
}

export async function sampleRosterXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("October");
  sheet.addRow([SAMPLE_ROSTER.title]);
  sheet.addRow([]);
  // Real exports store day headers as dates; the year is in the cell.
  sheet.addRow(["Name", "Grade", ...[1, 2, 3, 4].map((day) => new Date(Date.UTC(2026, 9, day)))]);
  for (const row of SAMPLE_ROSTER.rows) sheet.addRow([...row]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function escapePdf(text: string): string {
  return text.replace(/[\\()]/g, (character) => `\\${character}`);
}

/** A one-page text PDF with the sample roster drawn as a table, written by hand so no PDF library is needed. */
export function sampleRosterPdf(options: { scanned?: boolean } = {}): Buffer {
  const lines: string[] = [];
  if (!options.scanned) {
    const table = [SAMPLE_ROSTER.header, ...SAMPLE_ROSTER.rows];
    const columns = [40, 150, 220, 290, 360, 430];
    table.forEach((row, rowIndex) => {
      row.forEach((cell, column) => {
        if (!cell) return;
        lines.push(`BT /F1 9 Tf ${columns[column]} ${700 - rowIndex * 20} Td (${escapePdf(cell)}) Tj ET`);
      });
    });
    lines.unshift(`BT /F1 12 Tf 40 740 Td (${escapePdf(SAMPLE_ROSTER.title)}) Tj ET`);
  } else {
    lines.push("0.5 g 40 400 400 300 re f");
  }
  const stream = lines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}
