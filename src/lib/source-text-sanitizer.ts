const completeImageDataBlockPattern = /\[\[IMAGE_DATA_START\]\][\s\S]*?\[\[IMAGE_DATA_END\]\]/g;
const trailingImageDataBlockPattern = /\[\[IMAGE_DATA_START\]\][\s\S]*$/g;
const leadingImageDataBlockRemainderPattern = /^[\s\S]*?\[\[IMAGE_DATA_END\]\]/g;

const internalImageMetadataPattern =
  /\b(?:Image ID|Source kind|Image type|Table role|Clinical use class|Clinical use reason|Clinical signal score|Admin signal score|Storage path|Image path)\s*:\s*[^;|]+[;|]?\s*/gi;

const sourceDocumentCodeSource = String.raw`(?:[A-Z]{2,8}-[A-Z]{2,8}-\d{2,}(?:\/\d+)?|[A-Z]{2,8}-\d{3,}(?:\/\d+)?)`;
const sourceDocumentCodePattern = new RegExp(String.raw`\b${sourceDocumentCodeSource}\b`, "g");
const sourceDocumentCodeTestPattern = new RegExp(String.raw`\b${sourceDocumentCodeSource}\b`);
const pageBoilerplateSource = String.raw`Page\s+\d+\s+of\s+\d+`;
const pageBoilerplatePattern = new RegExp(String.raw`\b${pageBoilerplateSource}\b`, "gi");
const pageBoilerplateTestPattern = new RegExp(String.raw`\b${pageBoilerplateSource}\b`, "i");
const sourceTitleWithCodePattern = new RegExp(
  String.raw`(?:^|[\s.;])(?:[A-Z][A-Za-z0-9/&(),' -]{2,120}\s+)?(?:Guideline|Procedure|Protocol|Policy|Form)\s+${sourceDocumentCodeSource}(?:\s+${pageBoilerplateSource})?\.?`,
  "gi",
);
const sourceControlLinePattern =
  /\b(?:uncontrolled when printed|document control|document owner|authoris(?:ed|ation)|authorised by|published date|effective from|review date|version\s+\d+|amendment|supporting information|relevant standards|references)\b/i;
const clinicalSignalPattern =
  /\b(?:administer|anc|assess|baseline|blood|cease|contraindicat|dose|dosing|ecg|escalat|fbc|level|mg|mcg|mmol|monitor|neutrophil|prescrib|review|risk|symptom|threshold|titrate|toxicity|urgent|withhold|wbc)\b/i;
const provenancePhrasePattern =
  /\b(?:Source mentions|Source excerpt|Source passage|Document title|File name|citation_chunk_id|document_id)\s*:?\s*/gi;
const genericReferencePattern = /\s*(?:[-–]\s*)?refer to MIMS Product Information\.?/gi;

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

function tokenCount(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function stripLowYieldLines(value: string) {
  return value
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => {
      const normalized = compactWhitespace(line);
      if (!normalized) return true;
      const isControlLine = sourceControlLinePattern.test(normalized);
      const hasSourceMarker =
        sourceDocumentCodeTestPattern.test(normalized) || pageBoilerplateTestPattern.test(normalized);
      const hasClinicalSignal = clinicalSignalPattern.test(normalized);
      if (isControlLine && !hasClinicalSignal) return false;
      if (hasSourceMarker && normalized.length <= 140 && !hasClinicalSignal) return false;
      return true;
    })
    .join("\n");
}

export function stripLowYieldSourceNoise(text: string) {
  return stripLowYieldLines(text)
    .replace(sourceTitleWithCodePattern, " ")
    .replace(sourceDocumentCodePattern, " ")
    .replace(pageBoilerplatePattern, " ")
    .replace(provenancePhrasePattern, " ")
    .replace(genericReferencePattern, "")
    .replace(/\b(?:chunk|similarity)\s+\d+(?:\.\d+)?\b/gi, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/(?:\.\s*){2,}/g, ". ");
}

export function lowYieldSourceNoiseScore(text: string) {
  const originalTokens = tokenCount(compactWhitespace(text));
  if (!originalTokens) return 0;
  const cleanedTokens = tokenCount(compactWhitespace(stripLowYieldSourceNoise(text)));
  const sourceMarkerCount =
    (text.match(sourceDocumentCodePattern) ?? []).length + (text.match(pageBoilerplatePattern) ?? []).length;
  const removedRatio = Math.max(0, originalTokens - cleanedTokens) / originalTokens;
  return Math.max(0, Math.min(1, removedRatio + Math.min(0.35, sourceMarkerCount * 0.12)));
}

export function sourceTextForClinicalProse(text: string) {
  return compactWhitespace(stripLowYieldSourceNoise(stripInternalImageDataBlocks(text)));
}

export function sourceTextForClinicalProsePreservingBreaks(text: string) {
  return readableWhitespace(stripLowYieldSourceNoise(sourceTextForDisplayPreservingBreaks(text)));
}

export function isLowYieldClinicalText(text: string) {
  const cleaned = sourceTextForClinicalProse(text);
  if (!cleaned) return true;
  const hasClinicalSignal = clinicalSignalPattern.test(cleaned);
  const hasOnlyShortRemainder = tokenCount(cleaned) <= 5;
  const sourceNoise = lowYieldSourceNoiseScore(text);
  return sourceNoise >= 0.45 && (!hasClinicalSignal || hasOnlyShortRemainder);
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
    stripLowYieldSourceNoise(
      text
        .replace(completeImageDataBlockPattern, (block) => readableImageBlock(block))
        .replace(trailingImageDataBlockPattern, " ")
        .replace(leadingImageDataBlockRemainderPattern, " ")
        .replace(internalImageMetadataPattern, " "),
    ),
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
  const cleaned = sourceTextForClinicalProsePreservingBreaks(text)
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
