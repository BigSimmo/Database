"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { FavouritesHub } from "@/components/clinical-dashboard/favourites-hub";
import { appModeHomeHref } from "@/lib/app-modes";

type FavouritesHomePageProps = {
  query?: string;
};

export function FavouritesHomePage({ query = "" }: FavouritesHomePageProps) {
  const router = useRouter();
  const [queryOverride, setQueryOverride] = useState<{ source: string; value: string } | null>(null);
  const filterQuery = queryOverride?.source === query ? queryOverride.value : query;

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-[color:var(--background)] px-3 py-4 text-[color:var(--text)] sm:px-4 sm:py-5 lg:px-8">
      <FavouritesHub
        query={filterQuery}
        onClearQuery={() => {
          setQueryOverride({ source: query, value: "" });
          router.push(appModeHomeHref("favourites", { focus: true }));
        }}
        onAddFavourite={() => undefined}
      />
    </main>
  );
}
