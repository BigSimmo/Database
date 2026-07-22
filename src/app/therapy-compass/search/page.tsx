import type { Metadata } from "next";

import { SearchScreen } from "@/components/therapy-compass/screens/search-screen";

export const metadata: Metadata = {
  title: "Search therapies - Therapy mode",
  description: "Search the source-grounded therapy library by problem, symptom, skill, or population.",
};

export default function TherapyCompassSearchRoute() {
  return <SearchScreen />;
}
