import { headers } from "next/headers";
import { DocumentViewerLazy as DocumentViewer } from "@/components/document-viewer-lazy";
import {
  documentDetailQuerySchema,
  loadAuthorizedDocumentDetail,
  sanitizeDocumentDetailError,
} from "@/lib/document-detail";
import type { DocumentDetailPayload } from "@/lib/document-detail-contract";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; chunk?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const parsedPage = Number.parseInt(query.page ?? "", 10);
  const initialPage = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  let initialDetail: DocumentDetailPayload | undefined;
  let initialError: string | undefined;

  try {
    const detailQuery = documentDetailQuerySchema.parse({
      page: initialPage,
      chunk: query.chunk,
      assetScope: "window",
    });
    const requestHeaders = new Headers(await headers());
    const request = new Request(`http://document-detail.local/documents/${encodeURIComponent(id)}`, {
      headers: requestHeaders,
    });
    initialDetail = await loadAuthorizedDocumentDetail({ request, rawId: id, query: detailQuery });
  } catch (error) {
    initialError = sanitizeDocumentDetailError(error);
  }

  return (
    <DocumentViewer
      key={`${id}:${initialPage}:${query.chunk ?? ""}`}
      documentId={id}
      initialPage={initialPage}
      chunkId={query.chunk}
      initialDetail={initialDetail}
      initialError={initialError}
    />
  );
}
