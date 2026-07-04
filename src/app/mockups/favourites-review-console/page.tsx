import type { Metadata } from "next";

import { FavouritesLibraryRedesignPage } from "@/components/favourites-page-mockups/favourites-library-redesign-page";

export const metadata: Metadata = {
  title: "Favourites Review Console Mockup - Clinical KB",
  description: "Library-first favourites mockup with stronger review and provenance workflow.",
};

export default function FavouritesReviewConsoleMockupRoute() {
  return <FavouritesLibraryRedesignPage variant="review-console" />;
}
