import type { Metadata } from "next";

import { SourcesTopicsPage } from "@/components/sources/sources-pages";

export const metadata: Metadata = {
  title: "Source topics",
  description: "Browse clinical source topics and filtered catalogue links.",
};

export default function TopicsPage() {
  return <SourcesTopicsPage />;
}
