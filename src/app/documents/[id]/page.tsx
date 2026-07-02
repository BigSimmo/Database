import dynamic from "next/dynamic";

const DocumentViewer = dynamic(
  () => import("@/components/DocumentViewer").then((m) => m.DocumentViewer),
  { ssr: false },
);

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; chunk?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <DocumentViewer documentId={id} initialPage={Number(query.page ?? 1)} chunkId={query.chunk} />;
}
