import type { Metadata } from "next";

import { SourcesPublishersPage } from "@/components/sources/sources-pages";

export const metadata: Metadata = {
  title: "Source publishers",
  description: "Browse publisher coverage across the clinical source catalogue.",
};

export default function PublishersPage() {
  return <SourcesPublishersPage />;
}
