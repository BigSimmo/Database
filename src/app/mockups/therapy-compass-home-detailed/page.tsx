import type { Metadata } from "next";

import { HomeScreen } from "@/components/therapy-compass/screens/home-screen";

export const metadata: Metadata = {
  title: "Therapy home, detailed (retired) - Clinical KB",
  description:
    "The pre-consolidation Therapy home screen, kept as design scratch after every mode moved to the shared lightweight home.",
};

export default function TherapyCompassDetailedHomeMockupPage() {
  return <HomeScreen />;
}
