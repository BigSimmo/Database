import type { Metadata } from "next";

import { SpecifierMapPage } from "@/components/specifiers/specifier-map-page";

<<<<<<< HEAD
export const metadata: Metadata = {
  title: "Psychiatric specifier map - Clinical KB",
  description:
    "Browse psychiatric specifiers by diagnostic architecture: episode features, course and onset, severity and remission.",
};

=======
>>>>>>> origin/main
type MapRouteProps = {
  searchParams?: Promise<{ selected?: string | string[] }>;
};

<<<<<<< HEAD
export default async function SpecifierMapRoute({ searchParams }: MapRouteProps) {
  const params = searchParams ? await searchParams : {};
  const selected = Array.isArray(params.selected) ? params.selected[0] : params.selected;
  return <SpecifierMapPage key={selected ?? "default"} initialSlug={selected} />;
=======
export const metadata: Metadata = {
  title: "Specifier map",
  description:
    "Browse psychiatric specifiers by diagnostic architecture: episode features, course and onset, severity and remission.",
};

export default async function SpecifierMapRoute({ searchParams }: MapRouteProps) {
  const params = searchParams ? await searchParams : {};
  const selected = Array.isArray(params.selected) ? params.selected[0] : params.selected;
  return <SpecifierMapPage initialSlug={selected} />;
>>>>>>> origin/main
}
