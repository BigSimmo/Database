import { env } from "@/lib/env";
import type { ChunkInput, DocumentChunk } from "@/lib/types";

const sentenceBoundary = /(?<=[.!?])\s+/;
const paragraphBoundary = /\n{2,}/;

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

export function chunkTextWithOverlap(text: string, chunkSize = env.CHUNK_SIZE, overlap = env.CHUNK_OVERLAP) {
  const clean = text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!clean) return [];
  if (clean.length <= chunkSize) return [clean];

  const paragraphs = clean.split(paragraphBoundary).map((paragraph) => paragraph.trim()).filter(Boolean);
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
    start = Math.max(0, end - overlap);
  }

  return chunks;
}

export function buildImageTag(image: { id: string; caption: string }) {
  return `[[IMAGE_DATA_START]] Image ID: ${image.id}; Description: ${image.caption} [[IMAGE_DATA_END]]`;
}

export function buildChunks(inputs: ChunkInput[]) {
  const chunks: DocumentChunk[] = [];

  for (const input of inputs) {
    const pageImages = input.images ?? [];
    const imageContext = pageImages.map(buildImageTag).join("\n");
    const pageText = [input.pageText, imageContext].filter(Boolean).join("\n\n");
    const pageChunks = chunkTextWithOverlap(pageText);

    pageChunks.forEach((content, pageChunkIndex) => {
      const referencedImageIds = pageImages
        .filter((image) => content.includes(image.id) || content.includes(image.caption))
        .map((image) => image.id);

      chunks.push({
        document_id: input.documentId,
        page_number: input.pageNumber,
        chunk_index: chunks.length,
        section_heading: detectHeading(content),
        content,
        token_estimate: estimateTokens(content),
        image_ids: referencedImageIds,
        metadata: {
          ...(input.metadata ?? {}),
          page_chunk_index: pageChunkIndex,
          page_start: input.pageNumber,
          page_end: input.pageNumber,
        },
      });
    });
  }

  return chunks;
}
