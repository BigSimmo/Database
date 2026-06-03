const completeImageDataBlockPattern = /\[\[IMAGE_DATA_START\]\][\s\S]*?\[\[IMAGE_DATA_END\]\]/g;
const trailingImageDataBlockPattern = /\[\[IMAGE_DATA_START\]\][\s\S]*$/g;
const leadingImageDataBlockRemainderPattern = /^[\s\S]*?\[\[IMAGE_DATA_END\]\]/g;

const internalImageMetadataPattern =
  /\b(?:Image ID|Source kind|Image type|Table role|Clinical use class|Clinical use reason|Clinical signal score|Admin signal score|Storage path|Image path)\s*:\s*[^;|]+[;|]?\s*/gi;

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function readableWhitespace(value: string) {
  return value
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractImageBlockField(block: string, field: string) {
  const pattern = new RegExp(
    `${field}:\\s*([\\s\\S]*?)(?:;\\s*[A-Z][A-Za-z _-]{1,40}:|\\s*\\[\\[IMAGE_DATA_END\\]\\])`,
    "i",
  );
  return compactWhitespace(block.match(pattern)?.[1] ?? "");
}

function readableImageBlock(block: string) {
  const title = extractImageBlockField(block, "Table title");
  const label = extractImageBlockField(block, "Table label");
  const description = extractImageBlockField(block, "Description");
  const caption = extractImageBlockField(block, "Caption");

  return compactWhitespace(
    [title ? `Clinical table: ${title}` : "", label && !title ? `Clinical table: ${label}` : "", description || caption]
      .filter(Boolean)
      .join(". "),
  );
}

function tableCells(row: string) {
  return row
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => compactWhitespace(cell))
    .filter(Boolean);
}

function isSeparatorRow(cells: string[]) {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

function readableTableRows(tableText: string) {
  const normalizedRows = tableText
    .replace(/\r?\n/g, " ")
    .replace(/\|\s*\|\s*/g, "||")
    .split(/\s*\|\|\s*/)
    .map((row) => tableCells(row))
    .filter((cells) => cells.length > 0 && !isSeparatorRow(cells));

  if (normalizedRows.length === 0) return "";

  const [headers, ...rows] = normalizedRows;
  if (headers.length === 0) return "";
  if (rows.length === 0) return headers.join(" | ");

  return [
    headers.join(" | "),
    ...rows.slice(0, 8).map((row) => {
      const first = row[0] ?? "Row";
      const details = row
        .slice(1)
        .map((cell, index) => {
          const header = headers[index + 1];
          return header ? `${header}: ${cell}` : cell;
        })
        .join("; ");
      return details ? `- ${first}: ${details}` : `- ${first}`;
    }),
  ].join("\n");
}

function readableImageBlockForViewer(block: string) {
  const title = extractImageBlockField(block, "Table title");
  const label = extractImageBlockField(block, "Table label");
  const description = extractImageBlockField(block, "Description");
  const caption = extractImageBlockField(block, "Caption");
  const tableText = extractImageBlockField(block, "Table text");
  const intro = compactWhitespace(
    [title || label ? `Clinical table: ${title || label}` : "", description || caption].filter(Boolean).join(". "),
  );
  const table = readableTableRows(tableText);

  return readableWhitespace([intro, table].filter(Boolean).join("\n\n"));
}

export function stripInternalImageDataBlocks(text: string) {
  return compactWhitespace(
    text
      .replace(completeImageDataBlockPattern, " ")
      .replace(trailingImageDataBlockPattern, " ")
      .replace(leadingImageDataBlockRemainderPattern, " ")
      .replace(internalImageMetadataPattern, " "),
  );
}

export function sourceTextForModel(text: string) {
  return compactWhitespace(
    text
      .replace(completeImageDataBlockPattern, (block) => readableImageBlock(block))
      .replace(trailingImageDataBlockPattern, " ")
      .replace(leadingImageDataBlockRemainderPattern, " ")
      .replace(internalImageMetadataPattern, " "),
  );
}

export function sourceTextForDisplay(text: string) {
  return stripInternalImageDataBlocks(text);
}

export function sourceTextForDisplayPreservingBreaks(text: string) {
  return readableWhitespace(
    text
      .replace(completeImageDataBlockPattern, " ")
      .replace(trailingImageDataBlockPattern, " ")
      .replace(leadingImageDataBlockRemainderPattern, " ")
      .replace(internalImageMetadataPattern, " "),
  );
}

export function sourceTextForDocumentViewer(text: string) {
  return readableWhitespace(
    text
      .replace(completeImageDataBlockPattern, (block) => readableImageBlockForViewer(block))
      .replace(trailingImageDataBlockPattern, " ")
      .replace(leadingImageDataBlockRemainderPattern, " ")
      .replace(internalImageMetadataPattern, " "),
  );
}

export function sourceTextForIndexedPage(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(completeImageDataBlockPattern, (block) => readableImageBlockForViewer(block))
    .replace(trailingImageDataBlockPattern, " ")
    .replace(leadingImageDataBlockRemainderPattern, " ")
    .replace(internalImageMetadataPattern, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function cleanClinicalSummaryText(text: string) {
  const cleaned = sourceTextForDisplayPreservingBreaks(text)
    .replace(/\bSource mentions:\s*/gi, "")
    .replace(
      /(?:\s+-\s*)?(?:Medication point|Table evidence|Threshold\/action|Risk\/escalation|Workflow step|Section summary|Source point|Monitoring)\s*:\s*/gi,
      ". ",
    )
    .replace(/^\s*(?:[-•]\s+|\*\s+)+/, "")
    .replace(
      /^(?:key\s+(?:practical|clinical|source-backed)\s+points?|high-yield\s+points?|practical\s+points?|clinical\s+summary|document\s+summary|source-backed\s+summary|summary|bottom\s+line|answer)\s*[:\-]\s*/i,
      "",
    )
    .replace(/^\s*[.;:\-]\s*/, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/(?:\.\s*){2,}/g, ". ");

  return readableWhitespace(cleaned);
}
