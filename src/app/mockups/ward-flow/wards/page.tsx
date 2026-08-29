import type { Metadata } from "next";

import { WardIndex } from "@/components/ward-management/wards/ward-index";

export const metadata: Metadata = {
  title: "All wards — Ward Flow",
  description:
    "Synthetic ward index for the Ward Flow prototype — every ward grouped by health service, each linking to its own ward screen.",
};

export default function WardIndexPage() {
  return <WardIndex />;
}
