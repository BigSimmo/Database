import { DocumentViewerLazy as DocumentViewer } from "@/components/document-viewer-lazy";

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
  return <DocumentViewer documentId={id} initialPage={initialPage} chunkId={query.chunk} />;
}
