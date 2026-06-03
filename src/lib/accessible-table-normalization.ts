export type NormalizedAccessibleTable = {
  header: string[];
  body: string[][];
};

function compactCell(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function isEmptyCell(value: string | null | undefined) {
  const normalized = compactCell(value);
  return !normalized || /^[-–—]+$/.test(normalized);
}

function isGenericHeader(value: string | null | undefined) {
  const normalized = compactCell(value);
  return !normalized || /^column\s+\d+$/i.test(normalized);
}

function appendCell(existing: string, value: string) {
  const next = compactCell(value);
  if (!next) return existing;
  if (!existing) return next;
  if (next.length > 16 && existing.toLowerCase().includes(next.toLowerCase())) return existing;
  return `${existing} ${next}`;
}

function nearestNamedColumn(index: number, namedIndexes: number[]) {
  const previous = namedIndexes.filter((namedIndex) => namedIndex < index).at(-1);
  if (previous !== undefined) return previous;
  const next = namedIndexes.find((namedIndex) => namedIndex > index);
  return next ?? index;
}

function shouldStartNewRow(args: {
  normalizedRow: string[];
  rawRow: string[];
  keptIndexes: number[];
  previousRows: string[][];
}) {
  if (args.previousRows.length === 0) return true;
  const firstKeptIndex = args.keptIndexes[0] ?? 0;
  const firstRawCell = compactCell(args.rawRow[firstKeptIndex]);
  if (firstRawCell) return true;

  const firstNormalizedCell = compactCell(args.normalizedRow[0]);
  return /^[A-Z](?:\b|$)/.test(firstNormalizedCell) || /^\d{1,2}[.)]\s+/.test(firstNormalizedCell);
}

function looksLikeHeaderContinuation(args: { rawRow: string[]; keptIndexes: number[] }) {
  const firstKeptIndex = args.keptIndexes[0] ?? 0;
  if (compactCell(args.rawRow[firstKeptIndex])) return false;
  const nonEmptyCount = args.rawRow.filter((cell) => !isEmptyCell(cell)).length;
  if (nonEmptyCount === 0 || nonEmptyCount > 2) return false;
  const joined = args.rawRow.map(compactCell).filter(Boolean).join(" ");
  return !/^[A-F]\b/.test(joined);
}

export function normalizeAccessibleTable(
  rows: string[][],
  columns?: string[] | null,
): NormalizedAccessibleTable | null {
  const rawRows = rows.map((row) => row.map(compactCell)).filter((row) => row.some((cell) => !isEmptyCell(cell)));
  if (!rawRows.length) return null;

  const rawHeader = (columns?.length ? columns : rawRows[0]).map(compactCell);
  const rawBody = columns?.length ? rawRows : rawRows.slice(1);
  const sourceColumnCount = Math.max(rawHeader.length, ...rawBody.map((row) => row.length), 1);
  const paddedHeader = [
    ...rawHeader,
    ...Array.from({ length: Math.max(0, sourceColumnCount - rawHeader.length) }, () => ""),
  ];
  const namedIndexes = paddedHeader
    .map((cell, index) => (isGenericHeader(cell) ? null : index))
    .filter((index): index is number => index !== null);

  const keptIndexes = namedIndexes.length
    ? namedIndexes
    : Array.from({ length: sourceColumnCount }, (_, index) => index);
  const targetBySourceIndex = new Map<number, number>();

  for (let sourceIndex = 0; sourceIndex < sourceColumnCount; sourceIndex += 1) {
    const targetSourceIndex = namedIndexes.length
      ? isGenericHeader(paddedHeader[sourceIndex])
        ? nearestNamedColumn(sourceIndex, namedIndexes)
        : sourceIndex
      : sourceIndex;
    const targetIndex = keptIndexes.indexOf(targetSourceIndex);
    targetBySourceIndex.set(sourceIndex, targetIndex >= 0 ? targetIndex : 0);
  }

  const header = keptIndexes.map((sourceIndex, index) => {
    const label = compactCell(paddedHeader[sourceIndex]);
    return label || (keptIndexes.length === 1 ? "Details" : `Details ${index + 1}`);
  });

  const bodyRows = [...rawBody];
  while (bodyRows.length && looksLikeHeaderContinuation({ rawRow: bodyRows[0], keptIndexes })) {
    const continuation = bodyRows.shift() ?? [];
    continuation.forEach((cell, sourceIndex) => {
      if (isEmptyCell(cell)) return;
      const targetIndex = targetBySourceIndex.get(sourceIndex) ?? sourceIndex;
      if (targetIndex < 0 || targetIndex >= header.length) return;
      header[targetIndex] = appendCell(header[targetIndex], cell);
    });
  }

  const body: string[][] = [];
  for (const rawBodyRow of bodyRows) {
    const paddedRow = [
      ...rawBodyRow,
      ...Array.from({ length: Math.max(0, sourceColumnCount - rawBodyRow.length) }, () => ""),
    ];
    const normalizedRow = Array.from({ length: header.length }, () => "");

    paddedRow.forEach((cell, sourceIndex) => {
      if (isEmptyCell(cell)) return;
      const targetIndex = targetBySourceIndex.get(sourceIndex) ?? sourceIndex;
      if (targetIndex < 0 || targetIndex >= normalizedRow.length) return;
      normalizedRow[targetIndex] = appendCell(normalizedRow[targetIndex], cell);
    });

    if (!normalizedRow.some((cell) => !isEmptyCell(cell))) continue;
    if (!shouldStartNewRow({ normalizedRow, rawRow: paddedRow, keptIndexes, previousRows: body })) {
      const previous = body[body.length - 1];
      normalizedRow.forEach((cell, index) => {
        previous[index] = appendCell(previous[index] ?? "", cell);
      });
      continue;
    }

    body.push(normalizedRow);
  }

  const nonEmptyColumnIndexes = header
    .map((_, index) => index)
    .filter((index) => body.some((row) => !isEmptyCell(row[index])) || !isGenericHeader(header[index]));
  const finalHeader = nonEmptyColumnIndexes.map((index) => header[index]);
  const finalBody = body.map((row) => nonEmptyColumnIndexes.map((index) => row[index] ?? ""));

  if (!finalHeader.length || !finalBody.length) return null;
  return { header: finalHeader, body: finalBody };
}
