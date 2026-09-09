import type { Metadata } from "next";

import { FactsheetsTopicsPage } from "@/components/factsheets/factsheets-topics-page";
import { resolveFactsheetTopicParam } from "@/components/factsheets/factsheets-data";

export const metadata: Metadata = {
  title: "Factsheet topics | PsychSift",
  description: "Browse patient information factsheets organised by topic.",
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FactsheetsTopicsRoute({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string | string[] }>;
}) {
  const params = await searchParams;
  const selectedTopic = resolveFactsheetTopicParam(firstValue(params.topic));
  return <FactsheetsTopicsPage selectedTopic={selectedTopic} />;
}
