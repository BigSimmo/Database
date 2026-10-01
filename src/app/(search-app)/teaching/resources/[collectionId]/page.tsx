import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isCollectionParam } from "@/components/teaching/resources-model";
import { TeachingCollection } from "@/components/teaching/teaching-collection";
import { demoTeachingResources } from "@/lib/teaching/demo-resources";
import type { CollectionRead } from "@/lib/teaching/model";
import { teachingDemoMode, teachingSampleOn } from "@/lib/teaching/sample";

export const metadata: Metadata = {
  title: "Collection | Resources | Teaching | PsychSift",
  robots: { index: false, follow: false },
};

type TeachingCollectionRouteProps = { params: Promise<{ collectionId: string }> };

/** An organiser-made collection's id, or the built-in "recordings" or "saved". Anything else is not found. */
export default async function TeachingCollectionRoute({ params }: TeachingCollectionRouteProps) {
  const { collectionId } = await params;
  if (!isCollectionParam(collectionId)) notFound();
  let sampleData: CollectionRead | undefined;
  if (await teachingSampleOn()) {
    try {
      sampleData = demoTeachingResources({
        action: "collection.read",
        ...(collectionId === "saved" || collectionId === "recordings" ? { builtIn: collectionId } : { collectionId }),
      }) as CollectionRead;
    } catch {
      notFound();
    }
  }
  return <TeachingCollection collection={collectionId} demoMode={await teachingDemoMode()} sampleData={sampleData} />;
}
