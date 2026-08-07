// Row shapes for the document viewer's fetched detail payload (pages, images,
// table facts, chunks, full-document search hits, index health). Shared by the
// DocumentViewer container and its extracted presentation modules. The rows the
// viewer renders are exactly the rows `/api/documents/[id]` returns, so they
// alias the transport contract rather than restating it — a contract field that
// changes shape then fails typecheck here instead of drifting silently.

import type {
  DocumentDetailChunk,
  DocumentDetailImage,
  DocumentDetailIndexHealth,
  DocumentDetailPage,
  DocumentDetailTableFact,
} from "@/lib/document-detail-contract";

export type PageRow = DocumentDetailPage;

export type ImageRow = DocumentDetailImage;

export type TableFactRow = DocumentDetailTableFact;

export type ChunkRow = DocumentDetailChunk;

export type DocumentIndexHealth = DocumentDetailIndexHealth;

/** Client-side only: full-document search hits are built in the viewer, not by the detail payload. */
export type DocumentSearchResult = {
  id: string;
  page_number: number | null;
  chunk_index: number;
  section_heading: string | null;
  snippet: string;
  matched_terms: string[];
  image_ids: string[];
  score: number;
};
