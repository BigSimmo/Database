import { env } from "@/lib/env";
import { sourceSpanForText } from "@/lib/source-spans";
import type { ChunkInput, DocumentChunk } from "@/lib/types";

const sentenceBoundary = /(?<=[.!?])\s+/;
const paragraphBoundary = /\n{2,}/;
const metadataNoisePatterns: RegExp[] = [
  /\b(?:copyright|all rights reserved|document revision|do not distribute|downloaded from|www\.\S+)\b/i,
  /\b(?:version|revision)\s+\d+\s*$/i,
];
const lineNoisePatterns: RegExp[] = [
  /\b(page|p\.?)\s*\d+\s*(?:\/\s*\d+)?\b/i,
  /^\s*[-*_]{3,}\s*$/,
  /^\s*[\u25cf\u25e6\u2022]\s*$/,
];
const maxImageContextItemsPerPage = 3;

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
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
    const pageLines = new Set(
      input.pageText
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
  return sectionPath.includes(heading) ? Math.max(1, sectionPath.indexOf(heading) + 1) : Math.max(1, sectionPath.length);
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

export function chunkTextWithOverlap(text: string, chunkSize = env.CHUNK_SIZE, overlap = env.CHUNK_OVERLAP) {
  const clean = removePageNoise(text)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!clean) return [];
  if (clean.length <= chunkSize) return [clean];

  const paragraphs = clean
    .split(paragraphBoundary)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) {
    const chunks: string[] = [];
    let current = "";

    for (const paragraph of paragraphs) {
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
        current = paragraph;
      } else {
        current = candidate;
      }
    }

    if (current) chunks.push(current.trim());
    return chunks.filter(Boolean);
  }

  return chunkTextBySentence(clean, chunkSize, overlap);
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
    start = readableOverlapStart(clean, end, overlap);
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
  const parts = [
    `Image ID: ${image.id}`,
    image.sourceKind ? `Source kind: ${image.sourceKind}` : "",
    image.imageType ? `Image type: ${image.imageType}` : "",
    image.tableLabel ? `Table label: ${image.tableLabel}` : "",
    image.tableTitle ? `Table title: ${image.tableTitle}` : "",
    image.tableRole ? `Table role: ${image.tableRole}` : "",
    image.tableTextSnippet ? `Table text: ${compactImageText(image.tableTextSnippet)}` : "",
    image.accessibleTableMarkdown ? `Accessible table: ${compactImageText(image.accessibleTableMarkdown, 360)}` : "",
    `Description: ${image.caption}`,
  ].filter(Boolean);
  return `[[IMAGE_DATA_START]] ${parts.join("; ")} [[IMAGE_DATA_END]]`;
}

function buildPageImageContext(pageImages: NonNullable<ChunkInput["images"]>) {
  const selectedImages = pageImages.slice(0, maxImageContextItemsPerPage).map(buildImageTag);
  const omitted = pageImages.length - selectedImages.length;
  if (omitted > 0) {
    selectedImages.push(`[[IMAGE_DATA_OMITTED]] ${omitted} additional image/table blocks on this page. [[/IMAGE_DATA_OMITTED]]`);
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
    const cleanedPageText = removePageNoise(input.pageText, repeatedBoilerplateLines);
    const pageSectionPath = extractSectionHeadings(cleanedPageText);
    if (pageSectionPath.length > 0) activeSectionPath = pageSectionPath;
    const sectionPath = activeSectionPath;
    const pageText = [cleanedPageText, imageContext].filter(Boolean).join("\n\n");
    const pageLookupText = normalizeLookupText(input.pageText);
    const pageChunks = chunkTextWithOverlap(pageText);

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
      if (fingerprint && chunkFingerprint.has(fingerprint)) {
        return;
      }

      if (fingerprint) {
        chunkFingerprint.set(fingerprint, chunks.length);
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
        token_estimate: estimateTokens(content),
        image_ids: referencedImageIds,
        metadata: {
          ...(input.metadata ?? {}),
          page_chunk_index: pageChunkIndex,
          page_start: input.pageNumber,
          page_end: input.pageNumber,
          source_spans: [
            sourceSpanForText({
              pageNumber: input.pageNumber,
              pageText: input.pageText,
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
