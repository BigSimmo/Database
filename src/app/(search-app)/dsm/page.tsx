import type { Metadata } from "next";
import DsmPageClient from "./dsm-page-client";

export const metadata: Metadata = {
  title: "DSM-5 Diagnosis | Clinical KB",
  description: "Search, compare, and review structured DSM diagnosis criteria and differential considerations.",
};

export default function DsmHomeRoute() {
  return <DsmPageClient />;
}
