import type { Metadata } from "next";

import { FavouritesPhonePerfectedMockupsPage } from "@/components/favourites-phone-perfected-mockups";

export const metadata: Metadata = {
  title: "Favourites Phone Perfected Mockup - Clinical KB",
  description: "Phone-first Favourites page mockup drawn across every signed-in state.",
};

export default function FavouritesPhonePerfectedMockupRoute() {
  return <FavouritesPhonePerfectedMockupsPage />;
}
