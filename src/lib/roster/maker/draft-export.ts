import type { RosterDraft } from "./model";
import type { RosterPerson } from "@/lib/roster/team/model";
import { perthDateOf, perthTimeOf } from "@/lib/roster/shifts/perth-time";

/** Generic, visibly marked draft workbook. No payroll or noticeboard schema is implied. */
export async function buildRosterDraftWorkbook(
  draft: RosterDraft,
  people: readonly RosterPerson[],
): Promise<Uint8Array> {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("DRAFT roster", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.addRow(["DRAFT — NOT PUBLISHED"]);
  sheet.addRow(["Period", `${draft.draft.periodStart} to ${draft.draft.periodEnd}`]);
  sheet.addRow(["Draft version", String(draft.draft.version)]);
  sheet.addRow(["Exported at", new Date().toISOString()]);
  sheet.addRow([]);
  sheet.addRow([
    "Person",
    "Start date",
    "Start (Perth)",
    "End date",
    "End (Perth)",
    "Code",
    "Kind",
    "Site ID",
    "Grade",
  ]);
  const names = new Map(
    people.map((person) => [person.userId, person.rosterName || person.displayName || "Team member"]),
  );
  for (const row of draft.assignments) {
    sheet.addRow([
      row.userId ? (names.get(row.userId) ?? "Team member") : (row.rosterName ?? "Unfilled"),
      perthDateOf(row.startsAt),
      perthTimeOf(row.startsAt),
      perthDateOf(row.endsAt),
      perthTimeOf(row.endsAt),
      row.shiftCode,
      row.kind,
      row.siteId ?? "",
      row.grade ?? "",
    ]);
  }
  sheet.getColumn(1).width = 28;
  sheet.columns.slice(1).forEach((column) => {
    column.width = 19;
  });
  sheet.getRow(1).font = { bold: true, color: { argb: "FF9C1C1C" }, size: 16 };
  sheet.getRow(6).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 6 }];
  return new Uint8Array(await book.xlsx.writeBuffer());
}
