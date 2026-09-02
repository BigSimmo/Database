import type { Metadata } from "next";

import { SourcesCataloguePage } from "@/components/sources/sources-pages";

export const metadata: Metadata = {
  title: "Sources",
  description: "Ranked clinical source catalogue and traceability.",
};

export default function SourcesPage() {
  return <SourcesCataloguePage />;
}
