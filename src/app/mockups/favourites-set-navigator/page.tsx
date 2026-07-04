import type { Metadata } from "next";

import { FavouritesLibraryRedesignPage } from "@/components/favourites-page-mockups/favourites-library-redesign-page";

export const metadata: Metadata = {
  title: "Favourites Set Navigator Mockup - Clinical KB",
  description: "Library-first favourites mockup with workflow-set navigation.",
};

export default function FavouritesSetNavigatorMockupRoute() {
  return <FavouritesLibraryRedesignPage variant="set-navigator" />;
}
