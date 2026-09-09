import type { Metadata } from "next";

import { DictionaryComparePage } from "@/components/dictionary/dictionary-compare-page";
import { findDictionaryEntry } from "@/lib/dictionary";

export const metadata: Metadata = {
  title: "Compare clinical terms | PsychSift",
  description: "Align two source-governed dictionary entries field by field.",
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DictionaryCompareRoute({
  searchParams,
}: {
  searchParams?: Promise<{ a?: string | string[]; b?: string | string[] }>;
}) {
  const params = searchParams ? await searchParams : {};
  const a = findDictionaryEntry(firstValue(params.a));
  const candidateB = findDictionaryEntry(firstValue(params.b));
  const b = candidateB?.slug === a?.slug ? null : candidateB;
  return <DictionaryComparePage a={a} b={b} />;
}
