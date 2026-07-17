import type { Metadata } from "next";

import { TherapyCompassPage } from "@/components/therapy-compass";

export const metadata: Metadata = {
  title: "Therapy - Clinical KB",
  description:
    "Source-grounded therapy decision support: search, compare, recommend, pathways, brief interventions and patient sheets.",
};

type TherapyCompassRouteProps = {
  searchParams?: Promise<{ q?: string | string[]; run?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TherapyCompassRoute({ searchParams }: TherapyCompassRouteProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstParam(params.q)?.trim() ?? "";
  const autoRunSearch = firstParam(params.run) === "1" && query.length > 0;
  return <TherapyCompassPage initialQuery={query} autoRunSearch={autoRunSearch} />;
}
