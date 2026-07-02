const completeImageDataBlockPattern = /\[\[IMAGE_DATA_START\]\][\s\S]*?\[\[IMAGE_DATA_END\]\]/g;
const trailingImageDataBlockPattern = /\[\[IMAGE_DATA_START\]\][\s\S]*$/g;
const leadingImageDataBlockRemainderPattern = /^[\s\S]*?\[\[IMAGE_DATA_END\]\]/g;
// "N additional image/table blocks on this page" markers emitted by
// buildPageImageContext when a page exceeds the indexed-image cap; internal
// bookkeeping that must never render or be copied.
const omittedImageDataBlockPattern = /\[\[IMAGE_DATA_OMITTED\]\][\s\S]*?\[\[\/IMAGE_DATA_OMITTED\]\]/g;
const omittedImageDataMarkerPattern = /\[\[\/?IMAGE_DATA_OMITTED\]\]/g;

const internalImageMetadataPattern =
  /\b(?:Image ID|Source kind|Image type|Table role|Clinical use class|Clinical use reason|Clinical signal score|Admin signal score|Storage path|Image path)\s*:\s*[^;|]+[;|]?\s*/gi;
const internalImageTokenPattern =
  /\b(?:admin_table|clinical_table|decorative_image|diagram_crop|embedded_image|fallback_image|page_region|table_crop)\b/gi;

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
const evidenceLabelPattern =
  /(?:^|[\s.;])(?:dose|table|source|medication|monitoring|threshold|risk|action|documentation)\s+evidence\s*:\s*/gi;
const sourceTitleFragmentPattern =
  /\b(?:[A-Z][A-Za-z0-9/&(),' -]{2,120}\s+)?(?:Guideline|Procedure|Protocol|Policy|Appendix|Scale)\b[^.;]{0,180}/g;
const answerMetaIntroPattern =
  /^(?:the\s+)?(?:retrieved|supplied|provided|indexed)\s+(?:medication\/risk\s+)?(?:sources?|excerpts?|passages?)\s+(?:support|show|suggest|provide|returned)\s+(?:these\s+)?(?:practical\s+)?(?:points?|information|evidence)\.?\s*/i;
const provenanceNoiseTermPattern =
  /\b(?:guideline|procedure|protocol|policy|appendix|source|evidence|document|file|page|scale|lunsers|liverpool university|rating scale|retrieved|excerpt|passage)\b/gi;
const concreteClinicalActionPattern =
  /\b(?:administer|arrange|assess|cease|check|complete|contact|document|escalat|follow\s*up|monitor|notify|record|refer|report|review|stop|withhold|dose|prescrib|titrate)\b/i;
// Audit H2: threshold-bearing numerics (unit-bearing figures, ranges,
// comparatives like "8 or below", decimals) mark a fragment as carrying
// clinical VALUES. The noise heuristics below must never drop such a fragment:
// sourceTitleFragmentPattern greedily consumes up to 180 chars after a title
// keyword ("… Scale ranges from 3 to 15 …"), which silently deleted threshold
// sentences. Bare integers ("Appendix 1") deliberately do NOT match, so real
// title noise is still dropped. Falsely keeping noise is cosmetic; falsely
// dropping a threshold is a clinical-safety failure, so this leans generous.
const clinicalThresholdSignalPattern =
  /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|micrograms?|μg|µg|g|kg|ml|mmol|mol|units?|iu|hours?|hrs?|mins?|minutes?|days?|weeks?|months?|years?|mmhg|bpm|°c)\b|\b\d+(?:[.,]\d+)?\s*%|\b\d+(?:[.,]\d+)?\s*(?:[-–—]|to)\s*\d+(?:[.,]\d+)?\b|(?<![a-z0-9])(?:×|x)10\^?\d*|\b(?:below|above|under|over|at\s+least|at\s+most|more\s+than|less\s+than|greater\s+than|fewer\s+than)\s+\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?\s+or\s+(?:below|above|less|more|lower|higher|greater|fewer)\b|(?<![vV])\b\d+\.\d+\b/i;

// Typographic ligatures produced by PDF text extraction → plain ASCII letters.
const ligatureReplacements: Array<[RegExp, string]> = [
  [/ﬀ/g, "ff"],
  [/ﬁ/g, "fi"],
  [/ﬂ/g, "fl"],
  [/ﬃ/g, "ffi"],
  [/ﬄ/g, "ffl"],
  [/ﬅ/g, "st"],
  [/ﬆ/g, "st"],
];
// Zero-width / invisible formatting characters that survive extraction.
const invisibleCharacterPattern = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
// Whitespace-like controls (vertical tab, form feed, C1 NEL): these represent
// line/page breaks in extracted PDF text, so they become newlines rather than
// being deleted - deleting would fuse words ("dose\\fmonitoring").
const whitespaceControlPattern = /[\u000B\u000C\u0085]/g;
// Remaining C0/C1 control characters, excluding tab (\u0009) and newline (\u000A).
const controlCharacterPattern = /[\u0000-\u0008\u000E-\u001F\u007F-\u0084\u0086-\u009F]/g;

// Conservative, lossless repair of PDF-extraction glyph artifacts. Must NEVER
// remove clinical meaning: numbers, units, dose strings, comparison symbols
// (≥ ≤ < > → %), and legitimate bullet structure are all left untouched.
// Line-break hyphenation ("inter-\nvention") is deliberately NOT rejoined: a soft-wrap
// hyphen is indistinguishable from a real compound hyphen (low-dose, twice-daily), so
// fusing would corrupt clinical compounds and verbatim quotes.
// Idempotent — running it twice yields the same result.
export function normalizeExtractedGlyphs(value: string) {
  if (!value) return value;
  let out = value.normalize("NFC").replace(/\r\n?/g, "\n");
  for (const [pattern, replacement] of ligatureReplacements) out = out.replace(pattern, replacement);
  out = out
    .replace(/\u00AD/g, "") // soft hyphen
    .replace(invisibleCharacterPattern, "")
    .replace(whitespaceControlPattern, "\n")
    .replace(controlCharacterPattern, "");
  return out;
}

function compactWhitespace(value: string) {
  return normalizeExtractedGlyphs(value).replace(/\s+/g, " ").trim();
}

function readableWhitespace(value: string) {
  return normalizeExtractedGlyphs(value)
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
    .replace(internalImageTokenPattern, " ")
    .replace(sourceTitleWithCodePattern, " ")
    .replace(sourceDocumentCodePattern, " ")
    .replace(pageBoilerplatePattern, " ")
    .replace(provenancePhrasePattern, " ")
    .replace(evidenceLabelPattern, " ")
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

function sentenceFragments(text: string) {
  return text
    .replace(answerMetaIntroPattern, "")
    .split(/(?<=[.!?])\s+|\s*;\s*/)
    .map((fragment) =>
      compactWhitespace(
        fragment
          .replace(answerMetaIntroPattern, "")
          .replace(evidenceLabelPattern, " ")
          .replace(/^\s*[.;:\-]\s*/, ""),
      ),
    )
    .filter(Boolean);
}

function provenanceNoiseRatio(text: string) {
  const tokens = tokenCount(compactWhitespace(text));
  if (!tokens) return 1;
  const noiseHits = text.match(provenanceNoiseTermPattern)?.length ?? 0;
  return Math.min(1, noiseHits / tokens);
}

function isMostlySourceTitleFragment(text: string) {
  sourceTitleFragmentPattern.lastIndex = 0;
  const sourceTitleLength = (text.match(sourceTitleFragmentPattern) ?? []).join(" ").length;
  if (sourceTitleLength === 0) return false;
  return sourceTitleLength / Math.max(1, text.length) >= 0.38;
}

export function clinicalProseUsefulness(text: string) {
  const cleaned = sourceTextForClinicalProse(text);
  const keptFragments: string[] = [];
  const baselineKeptFragments: string[] = [];
  for (const fragment of sentenceFragments(cleaned)) {
    if (!fragment) continue;
    if (tokenCount(fragment) < 3) continue;
    if (/^the\s+(?:retrieved|supplied|provided|indexed)\s+/i.test(fragment)) continue;
    const hasClinicalSignal = clinicalSignalPattern.test(fragment);
    const hasConcreteClinicalAction = concreteClinicalActionPattern.test(fragment);
    // H2: a fragment carrying threshold-bearing numerics is never dropped by
    // the title/noise heuristics — deleting clinical values is worse than
    // keeping a little provenance noise.
    const hasClinicalThresholdSignal = clinicalThresholdSignalPattern.test(fragment);
    const noiseRatio = provenanceNoiseRatio(fragment);
    const mostlySourceTitle = isMostlySourceTitleFragment(fragment);
    const droppedByBaseline =
      (mostlySourceTitle && !hasConcreteClinicalAction) ||
      (noiseRatio >= 0.28 && !hasConcreteClinicalAction) ||
      (isLowYieldClinicalText(fragment) && !hasConcreteClinicalAction);
    const keptByBaseline = !droppedByBaseline && (hasClinicalSignal || hasConcreteClinicalAction || noiseRatio < 0.16);
    if (!keptByBaseline && !hasClinicalThresholdSignal) continue;
    keptFragments.push(fragment);
    if (keptByBaseline) baselineKeptFragments.push(fragment);
  }
  const textWithoutNoise = readableWhitespace(keptFragments.join(" "));
  const clinicalSignalScore =
    (textWithoutNoise.match(clinicalSignalPattern) ? 1 : 0) +
    (textWithoutNoise.match(concreteClinicalActionPattern) ? 1 : 0) +
    // H2: threshold values ARE clinical signal — text kept purely for its
    // thresholds must still be classifiable as useful.
    (textWithoutNoise.match(clinicalThresholdSignalPattern) ? 1 : 0);
  // Diff-review hardening of H2: the provenance score is computed over the
  // fragments the BASELINE criteria kept. A noise-dense fragment rescued only
  // for its threshold values must not inflate the score past the 0.42
  // usefulness gate — that flipped `useful` to false and made downstream
  // callers (rag-answer-text, ward-output) discard text that previously
  // survived, including its clean actionable sentences.
  const baselineText = readableWhitespace(baselineKeptFragments.join(" "));
  const provenanceScore = provenanceNoiseRatio(baselineText || textWithoutNoise || cleaned);
  return {
    text: textWithoutNoise,
    useful: Boolean(textWithoutNoise && clinicalSignalScore > 0 && provenanceScore < 0.42),
    clinicalSignalScore,
    provenanceScore,
  };
}

export function stripInternalImageDataBlocks(text: string) {
  return compactWhitespace(
    text
      .replace(completeImageDataBlockPattern, " ")
      .replace(trailingImageDataBlockPattern, " ")
      .replace(leadingImageDataBlockRemainderPattern, " ")
      .replace(omittedImageDataBlockPattern, " ")
      .replace(omittedImageDataMarkerPattern, " ")
      .replace(internalImageMetadataPattern, " "),
  );
}

// Exact source quotes keep their WORDING verbatim — no prose-polishing or
// noise-stripping that could add, drop, or reorder words — but they are not
// byte-verbatim: internal image-data blocks are removed, glyph artifacts
// (ligatures, soft hyphens, control chars) are repaired, and whitespace is
// collapsed to single spaces via compactWhitespace (quotes render as one
// continuous quotation, so newline collapse is presentational only; every
// word, hyphen, and punctuation mark is preserved).
export function sourceTextForVerbatimQuote(text: string) {
  return stripInternalImageDataBlocks(text);
}

export function sourceTextForModel(text: string) {
  return compactWhitespace(
    stripLowYieldSourceNoise(
      text
        .replace(completeImageDataBlockPattern, (block) => readableImageBlock(block))
        .replace(trailingImageDataBlockPattern, " ")
        .replace(leadingImageDataBlockRemainderPattern, " ")
        .replace(omittedImageDataBlockPattern, " ")
        .replace(omittedImageDataMarkerPattern, " ")
        .replace(internalImageMetadataPattern, " "),
    ),
  );
}

export function sourceTextForDisplay(text: string) {
  return readableWhitespace(stripLowYieldSourceNoise(stripInternalImageDataBlocks(text)));
}

export function sourceTextForDisplayPreservingBreaks(text: string) {
  return readableWhitespace(
    stripLowYieldSourceNoise(
      text
        .replace(completeImageDataBlockPattern, " ")
        .replace(trailingImageDataBlockPattern, " ")
        .replace(leadingImageDataBlockRemainderPattern, " ")
        .replace(omittedImageDataBlockPattern, " ")
        .replace(omittedImageDataMarkerPattern, " ")
        .replace(internalImageMetadataPattern, " "),
    ),
  );
}

export function sourceTextForCompactDisplay(text: string) {
  return readableWhitespace(
    sourceTextForDisplayPreservingBreaks(text)
      .replace(
        /(?:^|\n)\s*(?:source|sources|citation|citations|document|file|filename|chunk|page|image|provenance|retrieved|indexed)\s*(?:id|ids|index|number|path)?\s*[:#=-]\s*[^\n]+/gi,
        " ",
      )
      .replace(/\b(?:clinical table|table text|accessible table|image caption|caption|excerpt)\s*[:=-]\s*/gi, " ")
      .replace(/\b(?:source|chunk|document|image)\s*(?:id|index)?\s*[:#=-]?\s*[a-z0-9_-]{8,}\b/gi, " ")
      .replace(/\bpage\s*(?:number)?\s*[:#=-]?\s*(?:n\/a|\d+(?:\s*[-,]\s*\d+)*)\b/gi, " ")
      .replace(/\bchunk\s*(?:index)?\s*[:#=-]?\s*\d+\b/gi, " ")
      .replace(/\s+([,.;:])/g, "$1"),
  );
}

export function sourceTextForDocumentViewer(text: string) {
  return readableWhitespace(
    text
      .replace(completeImageDataBlockPattern, (block) => readableImageBlockForViewer(block))
      .replace(trailingImageDataBlockPattern, " ")
      .replace(leadingImageDataBlockRemainderPattern, " ")
      .replace(omittedImageDataBlockPattern, " ")
      .replace(omittedImageDataMarkerPattern, " ")
      .replace(internalImageMetadataPattern, " "),
  );
}

export function sourceTextForIndexedPage(text: string) {
  // normalizeExtractedGlyphs preserves spaces/tabs/newlines, so the fixed-width
  // spacing this viewer path relies on for table parsing survives the repair.
  return normalizeExtractedGlyphs(text)
    .replace(completeImageDataBlockPattern, (block) => readableImageBlockForViewer(block))
    .replace(trailingImageDataBlockPattern, " ")
    .replace(leadingImageDataBlockRemainderPattern, " ")
    .replace(omittedImageDataBlockPattern, " ")
    .replace(omittedImageDataMarkerPattern, " ")
    .replace(internalImageMetadataPattern, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function cleanClinicalSummaryText(text: string) {
  const cleaned = sourceTextForClinicalProsePreservingBreaks(text)
    .replace(/\bSource mentions:\s*/gi, "")
    .replace(
      /(?:\s+-\s*)?(?:Medication point|Dose evidence|Table evidence|Threshold\/action|Risk\/escalation|Workflow step|Section summary|Source point|Monitoring evidence|Monitoring)\s*:\s*/gi,
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
