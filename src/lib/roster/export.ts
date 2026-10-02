import "server-only";
import ExcelJS from "exceljs";
import { addDaysToDate, perthDateOf, perthTimeOf } from "@/lib/roster/shifts/perth-time";
import type { RosterAssignment, RosterPerson } from "./team/model";

/** Cell values are strings, never formulas. The file is built in memory only. */
export async function buildRosterWorkbook(
  assignments: readonly RosterAssignment[],
  people: readonly RosterPerson[],
  period: { from: string; to: string },
) {
  const book = new ExcelJS.Workbook();
  const days: string[] = [];
  for (let date = period.from; date <= period.to; date = addDaysToDate(date, 1)) days.push(date);
  const grid = book.addWorksheet("Roster", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
    views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
  });
  grid.addRow(["Person", ...days]);
  const rows = new Map(
    people.map((person) => [person.userId, person.displayName ?? person.rosterName ?? "Team member"]),
  );
  for (const shift of assignments)
    rows.set(
      shift.userId ?? `named:${shift.name ?? "Unnamed"}`,
      shift.name ?? rows.get(shift.userId ?? "") ?? "Unnamed",
    );
  for (const [id, name] of rows)
    grid.addRow([
      name,
      ...days.map((date) =>
        assignments
          .filter(
            (shift) =>
              (shift.userId ?? `named:${shift.name ?? "Unnamed"}`) === id && perthDateOf(shift.startsAt) === date,
          )
          .map((shift) => shift.shiftCode)
          .join(" / "),
      ),
    ]);
  grid.getColumn(1).width = 26;
  days.forEach((_, index) => {
    grid.getColumn(index + 2).width = 12;
  });
  grid.getRow(1).font = { bold: true };
  const detail = book.addWorksheet("Shift times", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  detail.addRow(["Person", "Start date", "Start (Perth)", "End date", "End (Perth)", "Code", "Kind", "Site"]);
  for (const shift of assignments)
    detail.addRow([
      shift.name ?? rows.get(shift.userId ?? "") ?? "Unnamed",
      perthDateOf(shift.startsAt),
      perthTimeOf(shift.startsAt),
      perthDateOf(shift.endsAt),
      perthTimeOf(shift.endsAt),
      shift.shiftCode,
      shift.kind,
      shift.siteName ?? "",
    ]);
  detail.columns.forEach((column) => {
    column.width = 22;
  });
  detail.getRow(1).font = { bold: true };
  return new Uint8Array(await book.xlsx.writeBuffer());
}
