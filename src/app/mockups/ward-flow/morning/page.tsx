import type { Metadata } from "next";

import { MorningPage } from "@/components/ward-management/morning/morning-page";

export const metadata: Metadata = {
  title: "Morning bed state — Ward Flow",
  description:
    "Synthetic morning bed state for the Ward Flow prototype — network, hospital and ward figures frozen to the 08:00 handover, with a live view alongside.",
};

export default function WardMorningPage() {
  return <MorningPage />;
}
