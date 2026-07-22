import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HomeScreen } from "@/components/therapy-compass/screens/home-screen";

export const metadata: Metadata = {
  title: "Therapy mode - Clinical KB",
  description:
    "Source-grounded therapy decision support: search, compare, recommend, pathways, brief interventions and patient sheets.",
};

type TherapyCompassHomeProps = {
  searchParams?: Promise<{ q?: string | string[]; run?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TherapyCompassHome({ searchParams }: TherapyCompassHomeProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstParam(params.q)?.trim() ?? "";
  const autoRun = firstParam(params.run) === "1" && query.length > 0;
  // A run-enabled mode search resolves to the home href (appModeHomeHref); send it
  // on to the dedicated, deep-linkable search route so the workspace opens on results.
  if (autoRun) redirect(`/therapy-compass/search?q=${encodeURIComponent(query)}&run=1`);
  return <HomeScreen />;
}
