export type IndexedTextBlock =
  | { type: "heading"; id: string; text: string; level: "title" | "section" }
  | { type: "paragraph"; id: string; text: string }
  | { type: "list"; id: string; items: string[] }
  | { type: "table"; id: string; caption: string; rows: string[][] };

function compactInline(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isPageFooter(line: string) {
  return /^page\s+\d+\s+of\s+\d+$/i.test(line.trim());
}

function isNumberedHeading(line: string) {
  return /^\d{1,2}\.\s+\S/.test(line.trim()) && line.trim().length <= 96;
}

function isLikelyTitle(rawLine: string, line: string, index: number) {
  if (index > 2) return false;
  if (line.length < 8 || line.length > 96) return false;
  if (/[.:;]$/.test(line)) return false;
  return rawLine.search(/\S/) >= 6 || /^[A-Z][A-Za-z\s,&/()-]+$/.test(line);
}

function isBulletLine(line: string) {
  return /^[•*-]\s+/.test(line.trim());
}

function cleanBullet(line: string) {
  return compactInline(line.trim().replace(/^[•*-]\s+/, ""));
}

function startsDataRow(line: string) {
  const trimmed = line.trim();
  if (/^(?:[<>]=?|[≥≤]|\d+(?:\.\d+)?\s*(?:hours?|days?|weeks?|months?)\b)/i.test(trimmed)) return true;
  return /^[A-Za-z]/.test(trimmed) && splitWideHeader(line).length >= 3;
}

function splitWideHeader(line: string) {
  return line
    .trim()
    .split(/\s{2,}/)
    .map(compactInline)
    .filter(Boolean);
}

function tableHeaderSignal(line: string) {
  const cells = splitWideHeader(line);
  if (cells.length < 3) return false;
  return /\b(?:dose|monitoring|blood|time|result|level|threshold|action|frequency|role|responsib|test)\b/i.test(
    cells.join(" "),
  );
}

function nearestColumnIndex(start: number, columnStarts: number[]) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < columnStarts.length; index += 1) {
    const distance = Math.abs(start - columnStarts[index]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function appendCell(row: string[], index: number, value: string) {
  const clean = compactInline(value);
  if (!clean) return;
  row[index] = compactInline([row[index], clean].filter(Boolean).join(" "));
}

function cellSlices(line: string, columnStarts: number[]) {
  return columnStarts.map((start, index) => {
    const end = columnStarts[index + 1] ?? line.length;
    return compactInline(line.slice(start, end));
  });
}

function parseFixedWidthTable(lines: string[], startIndex: number) {
  const headerLine = lines[startIndex] ?? "";
  const headers = splitWideHeader(headerLine);
  if (headers.length < 3) return null;

  const columnStarts = headers.map((header, index) => {
    const previousStart = index === 0 ? 0 : undefined;
    const found = headerLine.indexOf(header, previousStart);
    return found >= 0 ? found : index * 24;
  });
  const tableRows: string[][] = [];
  const headerCells = [...headers];
  let row: string[] | null = null;
  let index = startIndex + 1;

  for (; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();
    if (isPageFooter(line)) break;
    if (!line) continue;
    if (isNumberedHeading(line) && tableRows.length > 0) break;

    const firstTextIndex = rawLine.search(/\S/);
    const slices = cellSlices(rawLine, columnStarts);
    const hasRowStart = startsDataRow(rawLine);

    if (!row && !hasRowStart) {
      const targetIndex = nearestColumnIndex(Math.max(firstTextIndex, 0), columnStarts);
      appendCell(headerCells, targetIndex, line);
      continue;
    }

    if (hasRowStart && slices.some(Boolean)) {
      if (row && row.some(Boolean)) tableRows.push(row);
      row = Array.from({ length: headers.length }, () => "");
      const wideCells = splitWideHeader(rawLine);
      const initialCells = wideCells.length >= headers.length ? wideCells.slice(0, headers.length) : slices;
      initialCells.forEach((cell, cellIndex) => appendCell(row!, cellIndex, cell));
      continue;
    }

    if (row) {
      const targetIndex = nearestColumnIndex(Math.max(firstTextIndex, 0), columnStarts);
      const wideCells = splitWideHeader(rawLine);
      if (wideCells.length > 1) {
        wideCells.forEach((cell, offset) => appendCell(row!, Math.min(targetIndex + offset, headers.length - 1), cell));
      } else {
        appendCell(row, targetIndex, line);
      }
    }
  }

  if (row && row.some(Boolean)) tableRows.push(row);
  if (tableRows.length === 0) return null;

  return {
    block: {
      type: "table" as const,
      id: `table:${startIndex}`,
      caption: "Extracted clinical table",
      rows: [headerCells.map(compactInline), ...tableRows.map((cells) => cells.map(compactInline))],
    },
    nextIndex: index,
  };
}

function paragraphFrom(lines: string[]) {
  return compactInline(lines.join(" "));
}

export function parseIndexedSourceText(text: string): IndexedTextBlock[] {
  const rawLines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""));
  const blocks: IndexedTextBlock[] = [];
  let index = 0;

  while (index < rawLines.length) {
    const rawLine = rawLines[index] ?? "";
    const line = rawLine.trim();
    if (!line || isPageFooter(line)) {
      index += 1;
      continue;
    }

    if (tableHeaderSignal(rawLine)) {
      const parsedTable = parseFixedWidthTable(rawLines, index);
      if (parsedTable) {
        blocks.push(parsedTable.block);
        index = parsedTable.nextIndex;
        continue;
      }
    }

    if (isNumberedHeading(line)) {
      blocks.push({ type: "heading", id: `heading:${index}`, text: line, level: "section" });
      index += 1;
      continue;
    }

    if (blocks.length === 0 && isLikelyTitle(rawLine, line, index)) {
      blocks.push({ type: "heading", id: `title:${index}`, text: line, level: "title" });
      index += 1;
      continue;
    }

    if (isBulletLine(line)) {
      const items: string[] = [];
      while (index < rawLines.length && isBulletLine(rawLines[index] ?? "")) {
        const item = cleanBullet(rawLines[index] ?? "");
        if (item) items.push(item);
        index += 1;
      }
      if (items.length) blocks.push({ type: "list", id: `list:${index}:${items.length}`, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < rawLines.length) {
      const nextRawLine = rawLines[index] ?? "";
      const nextLine = nextRawLine.trim();
      if (
        !nextLine ||
        isPageFooter(nextLine) ||
        isNumberedHeading(nextLine) ||
        isBulletLine(nextLine) ||
        (paragraphLines.length > 0 && tableHeaderSignal(nextRawLine))
      ) {
        break;
      }
      paragraphLines.push(nextLine);
      index += 1;
    }

    const paragraph = paragraphFrom(paragraphLines);
    if (paragraph) blocks.push({ type: "paragraph", id: `paragraph:${index}:${paragraph.slice(0, 24)}`, text: paragraph });
  }

  return blocks;
}
