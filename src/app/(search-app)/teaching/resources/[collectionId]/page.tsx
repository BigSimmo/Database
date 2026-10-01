import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isCollectionParam } from "@/components/teaching/resources-model";
import { TeachingCollection } from "@/components/teaching/teaching-collection";
import { teachingDemoMode } from "@/lib/teaching/sample";

export const metadata: Metadata = {
  title: "Collection | Resources | Teaching | PsychSift",
  robots: { index: false, follow: false },
};

type TeachingCollectionRouteProps = { params: Promise<{ collectionId: string }> };

/** An organiser-made collection's id, or the built-in "recordings" or "saved". Anything else is not found. */
export default async function TeachingCollectionRoute({ params }: TeachingCollectionRouteProps) {
  const { collectionId } = await params;
  if (!isCollectionParam(collectionId)) notFound();
  return <TeachingCollection collection={collectionId} demoMode={await teachingDemoMode()} />;
}
