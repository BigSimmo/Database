import type { Metadata } from "next";

import { DsmHomePage } from "@/components/dsm/dsm-home-page";

export const metadata: Metadata = {
  title: "DSM-5 Diagnosis | Clinical KB",
  description: "Search, compare, and review structured DSM diagnosis criteria and differential considerations.",
};

export default function DsmHomeRoute() {
  return <DsmHomePage />;
}
