import type { Metadata } from "next";

import { SpecifierMapPage } from "@/components/specifiers/specifier-map-page";

export const metadata: Metadata = {
  title: "Psychiatric specifier map - Clinical KB",
  description:
    "Browse psychiatric specifiers by diagnostic architecture: episode features, course and onset, severity and remission.",
};

type MapRouteProps = {
  searchParams?: Promise<{ selected?: string | string[] }>;
};

export default async function SpecifierMapRoute({ searchParams }: MapRouteProps) {
  const params = searchParams ? await searchParams : {};
  const selected = Array.isArray(params.selected) ? params.selected[0] : params.selected;
  return <SpecifierMapPage key={selected ?? "default"} initialSlug={selected} />;
}
