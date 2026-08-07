"use client";

import dynamic from "next/dynamic";

import FormsLoading from "./loading";

const FormsHomePage = dynamic(() => import("@/components/forms/forms-home-page").then((mod) => mod.FormsHomePage), {
  ssr: false,
  loading: () => <FormsLoading />,
});

const FormsSearchResultsPage = dynamic(
  () => import("@/components/forms/forms-search-results-page").then((mod) => mod.FormsSearchResultsPage),
  {
    ssr: false,
    loading: () => <FormsLoading />,
  },
);

type FormsPageClientProps = {
  query: string;
  hasSubmittedSearch: boolean;
  defaultFormSlug: string | null;
};

export default function FormsPageClient({ query, hasSubmittedSearch, defaultFormSlug }: FormsPageClientProps) {
  if (!hasSubmittedSearch) {
    return <FormsHomePage defaultFormSlug={defaultFormSlug} />;
  }

  return <FormsSearchResultsPage query={query} />;
}
