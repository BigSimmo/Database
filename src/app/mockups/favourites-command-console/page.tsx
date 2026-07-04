import type { Metadata } from "next";

import { FavouritesLibraryRedesignPage } from "@/components/favourites-page-mockups/favourites-library-redesign-page";

export const metadata: Metadata = {
  title: "Favourites Command Console Mockup - Clinical KB",
  description: "Library-first favourites mockup with resume-next command workflow.",
};

export default function FavouritesCommandConsoleMockupRoute() {
  return <FavouritesLibraryRedesignPage variant="command-console" />;
}
