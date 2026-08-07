"use client";

import dynamic from "next/dynamic";

import SpecifiersLoading from "./loading";

const SpecifiersHomePage = dynamic(
  () => import("@/components/specifiers/specifiers-home-page").then((mod) => mod.SpecifiersHomePage),
  {
    ssr: false,
    loading: () => <SpecifiersLoading />,
  },
);

type SpecifiersPageClientProps = {
  query: string;
  hasSubmittedSearch: boolean;
};

export default function SpecifiersPageClient({ query, hasSubmittedSearch }: SpecifiersPageClientProps) {
  return <SpecifiersHomePage query={query} autoRunSearch={hasSubmittedSearch} />;
}
