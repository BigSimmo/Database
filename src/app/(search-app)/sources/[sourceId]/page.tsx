import type { Metadata } from "next";

import { SourceDetailPage } from "@/components/sources/sources-pages";

export const metadata: Metadata = {
  title: "Source traceability",
  description: "Identity, rating, locations and application usage for a clinical source.",
};

export default async function SourcePage({ params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  return <SourceDetailPage sourceId={sourceId} />;
}
