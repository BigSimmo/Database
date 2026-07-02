import { DocumentViewerClient } from "@/components/document-viewer-client";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; chunk?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <DocumentViewerClient documentId={id} initialPage={Number(query.page ?? 1)} chunkId={query.chunk} />;
}
