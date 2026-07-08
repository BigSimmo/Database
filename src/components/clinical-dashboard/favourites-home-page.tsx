"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { FavouritesHub } from "@/components/clinical-dashboard/favourites-hub";
import { appModeHomeHref } from "@/lib/app-modes";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";

type FavouritesHomePageProps = {
  query?: string;
};

export function FavouritesHomePage({ query = "" }: FavouritesHomePageProps) {
  const router = useRouter();
  const [queryOverride, setQueryOverride] = useState<{ source: string; value: string } | null>(null);
  const filterQuery = queryOverride?.source === query ? queryOverride.value : query;

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col bg-[color:var(--background)] px-0 py-4 text-[color:var(--text)] max-sm:pt-[clamp(1.25rem,4vh,2.25rem)] sm:min-h-[calc(100dvh-4rem)] sm:px-4 sm:py-5 lg:px-8">
      <div className="px-4 sm:px-0">
        <FavouritesHub
        query={filterQuery}
        onClearQuery={() => {
          setQueryOverride({ source: query, value: "" });
          router.push(appModeHomeHref("favourites", { focus: true }));
        }}
        onAddFavourite={() => undefined}
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        headingLevel={1}
      />
      </div>
    </main>
  );
}
