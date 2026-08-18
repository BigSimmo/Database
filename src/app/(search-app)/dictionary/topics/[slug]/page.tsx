import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DictionaryTopicDetailPage } from "@/components/dictionary/dictionary-catalogue-pages";
import { LoadingPanel } from "@/components/ui-primitives";
import { findDictionaryTopic } from "@/lib/dictionary";
import { dictionaryTopics } from "@/lib/dictionary-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return dictionaryTopics.map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const topic = findDictionaryTopic((await params).slug);
  return {
    title: topic ? `${topic.title} | Clinical Dictionary` : "Dictionary topic not found",
    description: topic?.description,
  };
}

export default async function DictionaryTopicRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!findDictionaryTopic(slug)) notFound();
  return (
    <Suspense fallback={<LoadingPanel variant="skeleton" lines={6} label="Loading dictionary topic" />}>
      <DictionaryTopicDetailPage topicSlug={slug} />
    </Suspense>
  );
}
