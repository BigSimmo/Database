import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DictionaryTermPage } from "@/components/dictionary/dictionary-term-page";
import { findDictionaryEntry } from "@/lib/dictionary";
import { dictionaryEntries } from "@/lib/dictionary-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return dictionaryEntries.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const entry = findDictionaryEntry((await params).slug);
  return {
    title: entry ? `${entry.term} | Clinical Dictionary` : "Dictionary entry not found",
    description: entry?.definition,
  };
}

export default async function DictionaryTermRoute({ params }: { params: Promise<{ slug: string }> }) {
  const entry = findDictionaryEntry((await params).slug);
  if (!entry) notFound();
  return <DictionaryTermPage entry={entry} />;
}
