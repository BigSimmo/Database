import { env } from "@/lib/env";
import { sourceSpanForText } from "@/lib/source-spans";
import { normalizeExtractedGlyphs } from "@/lib/source-text-sanitizer";
import type { ChunkInput, DocumentChunk } from "@/lib/types";

const sentenceBoundary = /(?<=[.!?])\s+/;
const paragraphBoundary = /\n{2,}/;
const metadataNoisePatterns: RegExp[] = [
  /\b(?:copyright|all rights reserved|document revision|do not distribute|downloaded from|www\.\S+)\b/i,
  /\b(?:version|revision)\s+\d+\s*$/i,
];
const lineNoisePatterns: RegExp[] = [
  // Audit M14: anchored to the WHOLE line. The previous unanchored form
  // matched an inline page reference anywhere in a sentence ("refer to p 3
  // for dosing", "titrate p 20 micrograms") and removePageNoise then deleted
  // the entire clinical line. Only a standalone page footer counts as noise.
  /^\s*(?:page|p\.?)\s*\d+\s*(?:(?:\/|of)\s*\d+)?\s*$/i,
  /^\s*[-*_]{3,}\s*$/,
  /^\s*[\u25cf\u25e6\u2022]\s*$/,
];
const maxImageContextItemsPerPage = 3;
const highYieldSectionPattern =
  /\b(?:medicat|dose|dosage|dosing|administer|titrate|threshold|cut[\s-]?off|withhold|cease|stop|monitor|baseline|fbc|anc|neutrophil|level|risk|red flag|urgent|escalat|contraindicat|caution|toxicity|required|must|criteria|observation)\b/i;
const narrativeSectionPattern =
  /\b(?:background|introduction|purpose|scope|principles|overview|rationale|references|bibliography|definitions)\b/i;
const boilerplateSynopsisPattern =
  /\b(?:document owner|authori[sz]ed by|published date|effective from|review date|version|amendment|copyright|uncontrolled when printed|supporting information|relevant standards)\b/i;

export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

export function detectHeading(text: string) {
  const firstMeaningfulLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && line.length < 120);

  if (!firstMeaningfulLine) return null;
  if (/^[A-Z0-9][A-Za-z0-9\s,;:()[\]/-]{3,}$/.test(firstMeaningfulLine)) {
    return firstMeaningfulLine.replace(/[:.\s]+$/, "");
  }

  return null;
}

function normalizeLookupText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:table|figure|appendix)\b/g, "")
    .trim();
}

function looksLikeMetadataNoise(line: string) {
  if (!line || line.length <= 2) return true;
  if (/^\d+$/.test(line)) return true;
  if (metadataNoisePatterns.some((pattern) => pattern.test(line))) return true;
  if (lineNoisePatterns.some((pattern) => pattern.test(line))) return true;
  return false;
}

function normalizeRepeatedLine(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function looksLikeRepeatingBoilerplate(line: string) {
  const normalized = normalizeRepeatedLine(line);
  if (!normalized || normalized.length < 5 || normalized.length > 90) return false;
  if (looksLikeMetadataNoise(line)) return true;
  if (/^(?:clinical|corporate|mental health|government|department|hospital|health service)\b/i.test(line)) return true;
  if (/\b(?:confidential|printed|uncontrolled|guideline|procedure|policy|document|version|review date)\b/i.test(line)) {
    return true;
  }
  return false;
}

function buildRepeatedBoilerplateLines(inputs: ChunkInput[]) {
  const counts = new Map<string, number>();
  for (const input of inputs) {
    // Keys must be built from the SAME normalized text that removePageNoise
    // later compares against, or a ligature/soft-hyphen in a repeated header
    // ("Conﬁdential") would produce a mismatched key and survive filtering.
    const pageLines = new Set(
      normalizeExtractedGlyphs(input.pageText)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(looksLikeRepeatingBoilerplate)
        .map(normalizeRepeatedLine)
        .filter(Boolean),
    );
    for (const line of pageLines) {
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
  }
  return new Set([...counts.entries()].filter(([, count]) => count >= 2).map(([line]) => line));
}

function removePageNoise(text: string, repeatedBoilerplateLines = new Set<string>()) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (line === "") return true;
      if (looksLikeMetadataNoise(line)) return false;
      if (repeatedBoilerplateLines.has(normalizeRepeatedLine(line))) return false;
      return true;
    })
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractSectionHeadings(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || line.length < 4) return false;
      if (looksLikeMetadataNoise(line)) return false;
      if (line.length < 90 && /^[A-Z][A-Za-z0-9\s,;:()\/\-\[\]]+$/.test(line)) return true;
      if (/^\d+\.?\s+[A-Z]/.test(line) && line.length < 110) return true;
      return false;
    });
}

function sectionAnchorId(heading: string | null) {
  if (!heading) return null;
  return (
    heading
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || null
  );
}

function headingLevel(heading: string | null, sectionPath: string[]) {
  if (!heading) return sectionPath.length > 0 ? Math.min(sectionPath.length, 6) : null;
  const numbered = heading.match(/^(\d+(?:\.\d+){0,5})\b/);
  if (numbered) return Math.min(numbered[1].split(".").length, 6);
  return sectionPath.includes(heading)
    ? Math.max(1, sectionPath.indexOf(heading) + 1)
    : Math.max(1, sectionPath.length);
}

function imageMatchScore(lookupText: string, sourceText: string) {
  if (!lookupText || !sourceText) return 0;
  const source = new Set(sourceText.split(/\s+/).filter(Boolean));
  const hits = lookupText
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => source.has(token)).length;
  return hits;
}

function dedupeChunkFingerprint(text: string) {
  return normalizeLookupText(text).replace(/\s+/g, " ").trim();
}

function clampChunkSize(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function adaptiveChunkProfile(text: string, sectionPath: string[]) {
  const sectionText = sectionPath.join(" ");
  const highYield = highYieldSectionPattern.test(`${sectionText}\n${text}`);
  const narrative = narrativeSectionPattern.test(sectionText) && !highYield;
  const baseSize = env.CHUNK_SIZE;
  const baseOverlap = env.CHUNK_OVERLAP;

  if (highYield) {
    return {
      chunkSize: clampChunkSize(Math.min(baseSize * 0.62, 1250), 850, baseSize),
      overlap: clampChunkSize(Math.max(baseOverlap, baseSize * 0.12), 180, 340),
      profile: "high_yield",
    };
  }

  if (narrative) {
    return {
      chunkSize: clampChunkSize(Math.max(baseSize * 1.35, 2600), baseSize, 3400),
      overlap: clampChunkSize(Math.min(baseOverlap, 180), 80, baseOverlap),
      profile: "narrative",
    };
  }

  return {
    chunkSize: baseSize,
    overlap: baseOverlap,
    profile: "standard",
  };
}

export function chunkTextWithOverlap(text: string, chunkSize = env.CHUNK_SIZE, overlap = env.CHUNK_OVERLAP) {
  const clean = removePageNoise(normalizeExtractedGlyphs(text))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!clean) return [];
  if (clean.length <= chunkSize) return [clean];

  if (isTableBlock(clean)) {
    return chunkTableBlock(clean, chunkSize);
  }

  const paragraphs = clean
    .split(paragraphBoundary)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) {
    const chunks: string[] = [];
    let current = "";

    for (const paragraph of paragraphs) {
      if (isTableBlock(paragraph)) {
        if (current) {
          chunks.push(current.trim());
          current = "";
        }
        chunks.push(...chunkTableBlock(paragraph, chunkSize));
        continue;
      }

      if (paragraph.length > chunkSize) {
        if (current) {
          chunks.push(current.trim());
          current = "";
        }
        chunks.push(...chunkTextBySentence(paragraph, chunkSize, overlap));
        continue;
      }

      const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
      if (candidate.length > chunkSize && current) {
        chunks.push(current.trim());
        const flushed = current.trim();
        const tail = readableOverlapTail(flushed, overlap);
        current = tail ? `${tail}\n\n${paragraph}` : paragraph;
      } else {
        current = candidate;
      }
    }

    if (current) chunks.push(current.trim());
    return chunks.filter(Boolean);
  }

  return chunkTextBySentence(clean, chunkSize, overlap);
}

function readableOverlapTail(text: string, overlap: number) {
  if (overlap <= 0 || !text) return "";
  if (text.length <= overlap) return text;
  const start = readableOverlapStart(text, text.length, overlap);
  return text.slice(start).trim();
}

const tableRowPattern = /^\s*\|.*\|\s*$/;

function isTableBlock(block: string) {
  const lines = block.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return false;
  return lines.every((line) => tableRowPattern.test(line));
}

function chunkTableBlock(block: string, chunkSize: number) {
  const lines = block.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (block.length <= chunkSize) return [block.trim()];

  const separatorIndex = lines.findIndex((line) => /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-"));
  const headerLines = separatorIndex > 0 ? lines.slice(0, separatorIndex + 1) : lines.slice(0, 1);
  const bodyLines = lines.slice(headerLines.length);
  const header = headerLines.join("\n");

  const chunks: string[] = [];
  let current = header;
  for (const row of bodyLines) {
    const candidate = `${current}\n${row}`;
    if (candidate.length > chunkSize && current !== header) {
      chunks.push(current.trim());
      current = `${header}\n${row}`;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [block.trim()];
}

function readableOverlapStart(clean: string, end: number, overlap: number) {
  if (overlap <= 0) return end;
  let start = Math.max(0, end - overlap);

  while (start > 0 && start < end && /\S/.test(clean[start - 1] ?? "") && /\S/.test(clean[start] ?? "")) {
    start -= 1;
  }
  while (start < end && /\s/.test(clean[start] ?? "")) {
    start += 1;
  }

  return start < end ? start : Math.max(0, end - overlap);
}

function chunkTextBySentence(clean: string, chunkSize: number, overlap: number) {
  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length);
    const window = clean.slice(start, end);
    const sentences = window.split(sentenceBoundary);

    if (end < clean.length && sentences.length > 1) {
      const rebuilt = sentences.slice(0, -1).join(" ");
      if (rebuilt.length > chunkSize * 0.55) {
        end = start + rebuilt.length;
      }
    }

    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;
    // Audit M17: when overlap >= chunkSize, readableOverlapStart can return a
    // position at or before the current start and the loop never advances,
    // hanging the ingestion worker on that document. Force strict forward
    // progress: if the overlap window does not move us forward, continue from
    // the end of the current chunk instead.
    const nextStart = readableOverlapStart(clean, end, overlap);
    start = nextStart > start ? nextStart : end;
  }

  return chunks;
}

function compactImageText(value: string | null | undefined, limit = 420) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit - 3).trim()}...` : text;
}

function compactSynopsisText(value: string | null | undefined, limit = 720) {
  const withoutImageTags = String(value ?? "")
    .replace(/\[\[IMAGE_DATA_START\]\][\s\S]*?\[\[IMAGE_DATA_END\]\]/g, " ")
    .replace(/\[\[IMAGE_DATA_OMITTED\]\][\s\S]*?\[\[\/IMAGE_DATA_OMITTED\]\]/g, " ");
  const sentences = withoutImageTags
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 12 && !boilerplateSynopsisPattern.test(sentence));
  const highYieldSentences = sentences.filter((sentence) => highYieldSectionPattern.test(sentence));
  const selected = (highYieldSentences.length ? highYieldSentences : sentences).slice(0, 4).join(" ");
  const compact = selected.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact.length > limit ? `${compact.slice(0, limit - 3).trim()}...` : compact;
}

function buildRetrievalSynopsis(args: {
  content: string;
  heading: string | null;
  sectionContext: string[];
  pageNumber: number | null;
  referencedImageCount: number;
}) {
  const section = args.sectionContext.length ? args.sectionContext.join(" > ") : args.heading;
  const prefix = [
    section ? `Section: ${section}` : "",
    args.pageNumber ? `Page: ${args.pageNumber}` : "",
    args.referencedImageCount > 0 ? `Visual/table context: ${args.referencedImageCount}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  const facts = compactSynopsisText(args.content);
  return [prefix, facts].filter(Boolean).join(" | ").slice(0, 900);
}

export function buildImageTag(image: {
  id: string;
  caption: string;
  imageType?: string | null;
  sourceKind?: string | null;
  tableLabel?: string | null;
  tableTitle?: string | null;
  tableRole?: string | null;
  tableTextSnippet?: string | null;
  accessibleTableMarkdown?: string | null;
}) {
  const conciseTableText = image.tableTextSnippet
    ? `Table text: ${compactImageText(image.tableTextSnippet, 220)}`
    : image.accessibleTableMarkdown
      ? `Table text: ${compactImageText(image.accessibleTableMarkdown, 220)}`
      : "";
  const parts = [
    `Image ID: ${image.id}`,
    image.sourceKind ? `Source kind: ${image.sourceKind}` : "",
    image.imageType ? `Image type: ${image.imageType}` : "",
    image.tableLabel ? `Table label: ${image.tableLabel}` : "",
    image.tableTitle ? `Table title: ${image.tableTitle}` : "",
    image.tableRole ? `Table role: ${image.tableRole}` : "",
    conciseTableText,
    `Description: ${compactImageText(image.caption, 260)}`,
  ].filter(Boolean);
  return `[[IMAGE_DATA_START]] ${parts.join("; ")} [[IMAGE_DATA_END]]`;
}

function buildPageImageContext(pageImages: NonNullable<ChunkInput["images"]>) {
  const selectedImages = pageImages.slice(0, maxImageContextItemsPerPage).map(buildImageTag);
  const omitted = pageImages.length - selectedImages.length;
  if (omitted > 0) {
    selectedImages.push(
      `[[IMAGE_DATA_OMITTED]] ${omitted} additional image/table blocks on this page. [[/IMAGE_DATA_OMITTED]]`,
    );
  }
  return selectedImages.join("\n");
}

export function buildChunks(inputs: ChunkInput[]) {
  const chunks: DocumentChunk[] = [];
  const chunkFingerprint = new Map<string, number>();
  const repeatedBoilerplateLines = buildRepeatedBoilerplateLines(inputs);
  let activeSectionPath: string[] = [];

  for (const input of inputs) {
    const pageImages = input.images ?? [];
    const imageContext = buildPageImageContext(pageImages);
    // Normalize glyph artifacts once so chunk content, the heading lookup, and the
    // source-span excerpt all derive from the same text. Otherwise the normalized
    // excerpt cannot be located in the raw page and span offsets drop to null.
    const normalizedPageText = normalizeExtractedGlyphs(input.pageText);
    const cleanedPageText = removePageNoise(normalizedPageText, repeatedBoilerplateLines);
    const pageSectionPath = extractSectionHeadings(cleanedPageText);
    if (pageSectionPath.length > 0) activeSectionPath = pageSectionPath;
    const sectionPath = activeSectionPath;
    const pageText = [cleanedPageText, imageContext].filter(Boolean).join("\n\n");
    const pageLookupText = normalizeLookupText(normalizedPageText);
    const chunkProfile = adaptiveChunkProfile(cleanedPageText, sectionPath);
    const pageChunks = chunkTextWithOverlap(pageText, chunkProfile.chunkSize, chunkProfile.overlap);

    pageChunks.forEach((content, pageChunkIndex) => {
      const contentLookup = normalizeLookupText(content);
      const heading = detectHeading(content);
      const sectionContext = sectionPath.includes(heading ?? "") ? sectionPath : [...sectionPath];
      const sectionAnchor = sectionAnchorId(heading);
      const level = headingLevel(heading, sectionContext);
      const parentHeading = sectionContext.length > 1 ? sectionContext[sectionContext.length - 2] : null;
      const referencedImageIds = pageImages
        .filter((image) => {
          const label = normalizeLookupText(image.tableLabel ?? "");
          const title = normalizeLookupText(image.tableTitle ?? "");
          const caption = normalizeLookupText(image.caption);
          const imageText = [label, title, caption]
            .filter(Boolean)
            .flatMap((value) => value.split(/\s+/).filter(Boolean));
          const imageLookup = imageText.join(" ");
          const headerBoost =
            heading && imageText.some((token) => normalizeLookupText(heading).includes(token)) ? 1 : 0;
          const direct =
            imageMatchScore(caption, contentLookup) >= 1 || imageMatchScore(imageLookup, contentLookup) >= 2;
          const pathHit =
            sectionContext.some((candidate) =>
              normalizeLookupText(candidate)
                .split(/\s+/)
                .some((token) => imageLookup.includes(token)),
            ) && image.sourceKind !== "embedded";
          return direct || pathHit || (image.sourceKind === "table_crop" && headerBoost > 0) || headerBoost >= 1;
        })
        .map((image) => image.id);

      const fingerprint = dedupeChunkFingerprint(content);
      const pageScopedFingerprint = fingerprint ? `${input.pageNumber ?? "unknown"}:${fingerprint}` : "";
      if (pageScopedFingerprint && chunkFingerprint.has(pageScopedFingerprint)) {
        return;
      }

      if (pageScopedFingerprint) {
        chunkFingerprint.set(pageScopedFingerprint, chunks.length);
      }
      chunks.push({
        document_id: input.documentId,
        page_number: input.pageNumber,
        chunk_index: chunks.length,
        section_heading: heading,
        section_path: sectionContext,
        heading_level: level,
        parent_heading: parentHeading,
        anchor_id: sectionAnchor,
        content,
        retrieval_synopsis: buildRetrievalSynopsis({
          content,
          heading,
          sectionContext,
          pageNumber: input.pageNumber,
          referencedImageCount: referencedImageIds.length,
        }),
        token_estimate: estimateTokens(content),
        image_ids: referencedImageIds,
        metadata: {
          ...(input.metadata ?? {}),
          page_chunk_index: pageChunkIndex,
          chunk_profile: chunkProfile.profile,
          adaptive_chunk_size: chunkProfile.chunkSize,
          adaptive_chunk_overlap: chunkProfile.overlap,
          page_start: input.pageNumber,
          page_end: input.pageNumber,
          source_spans: [
            sourceSpanForText({
              pageNumber: input.pageNumber,
              pageText: normalizedPageText,
              excerpt: content.replace(/\[\[IMAGE_DATA_START\]\][\s\S]*?\[\[IMAGE_DATA_END\]\]/g, "").trim(),
              fallbackExcerpt: content,
            }),
          ],
          heading_lookup: pageLookupText,
          subsection_path: sectionContext,
          section_anchor: sectionAnchor,
          section_path: sectionContext,
          heading_level: level,
          parent_heading: parentHeading,
          anchor_id: sectionAnchor,
        },
      });
    });
  }

  return chunks;
}
