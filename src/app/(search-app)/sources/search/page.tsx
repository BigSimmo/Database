import type { Metadata } from "next";

import { SourcesCataloguePage } from "@/components/sources/sources-pages";

export const metadata: Metadata = {
  title: "Source catalogue",
  description: "Filter and sort the ranked clinical source catalogue by quality, jurisdiction, publisher and usage.",
};

export default function SourcesSearchPage() {
  return <SourcesCataloguePage />;
}
