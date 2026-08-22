import type { Metadata } from "next";

import { DsmHomePage } from "@/components/dsm/dsm-home-page";

export const metadata: Metadata = {
  title: "DSM-5 Diagnosis home, detailed (retired) - Clinical KB",
  description:
    "The pre-consolidation DSM-5 Diagnosis home page, kept as design scratch after every mode moved to the shared lightweight home.",
};

export default function DsmDetailedHomeMockupPage() {
  return <DsmHomePage />;
}
