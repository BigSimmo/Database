import type { Metadata } from "next";

import { SourcesMethodPage } from "@/components/sources/sources-pages";

export const metadata: Metadata = {
  title: "Source catalogue method",
  description: "Rating method, limitations and status definitions for Sources.",
};

export default function MethodPage() {
  return <SourcesMethodPage />;
}
