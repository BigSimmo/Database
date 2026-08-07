"use client";

import dynamic from "next/dynamic";

import DifferentialsLoading from "./loading";

const DifferentialsHomePage = dynamic(
  () => import("@/components/differentials/differentials-home-page").then((mod) => mod.DifferentialsHomePage),
  {
    ssr: false,
    loading: () => <DifferentialsLoading />,
  },
);

type DifferentialsPageClientProps = {
  query: string;
  hasSubmittedSearch: boolean;
};

export default function DifferentialsPageClient({ query, hasSubmittedSearch }: DifferentialsPageClientProps) {
  return <DifferentialsHomePage query={query} autoRunSearch={hasSubmittedSearch} />;
}
