"use client";

import dynamic from "next/dynamic";

import ServicesLoading from "./loading";

const ServicesHomePage = dynamic(
  () => import("@/components/services/services-home-page").then((mod) => mod.ServicesHomePage),
  {
    ssr: false,
    loading: () => <ServicesLoading />,
  },
);

const ServicesNavigatorPage = dynamic(
  () => import("@/components/services/services-navigator-page").then((mod) => mod.ServicesNavigatorPage),
  {
    ssr: false,
    loading: () => <ServicesLoading />,
  },
);

type ServicesPageClientProps = {
  hasSubmittedSearch: boolean;
  defaultServiceSlug: string | null;
};

export default function ServicesPageClient({ hasSubmittedSearch, defaultServiceSlug }: ServicesPageClientProps) {
  if (!hasSubmittedSearch) {
    // Keep this server computation path separate from search mode on the client.
    return <ServicesHomePage defaultServiceSlug={defaultServiceSlug} />;
  }

  return <ServicesNavigatorPage />;
}
