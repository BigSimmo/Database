import type { Metadata } from "next";

import { ShipFirstRedesignGallery } from "@/components/ship-first-redesign-mockups/gallery";

export const metadata: Metadata = {
  title: "Ship-first redesign perfected - Clinical KB",
  description:
    "Perfected interactive mockups for answer safety, tools/services/favourites search, documents filter, and save-to-favourites.",
};

export default function ShipFirstRedesignMockupPage() {
  return <ShipFirstRedesignGallery />;
}
