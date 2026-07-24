import { redirect } from "next/navigation";
import { connection } from "next/server";

import { HomePageClient } from "./home-page-client";
import { appModeHomeHref, isAppModeId, isAppModeVisible, type AppModeId } from "@/lib/app-modes";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomeProps) {
  // The dashboard reads and updates the query string throughout its client
  // lifecycle. Render it for the incoming request so `useSearchParams()` is
  // available during the initial server render instead of leaving the entire
  // interactive shell behind a hydration-only Suspense fallback.
  await connection();
  const params = searchParams ? await searchParams : {};
  const requestedMode = firstSearchParam(params.mode);
  const initialSearchMode: AppModeId =
    isAppModeId(requestedMode) && isAppModeVisible(requestedMode) ? requestedMode : "answer";

  // /favourites is the canonical favourites surface; deep links via the
  // dashboard mode param would otherwise open a divergent hub view.
  if (initialSearchMode === "favourites") {
    const favouriteParams = new URLSearchParams();
    const query = firstSearchParam(params.q)?.trim();
    if (query) favouriteParams.set("q", query);
    if (firstSearchParam(params.focus) === "1") favouriteParams.set("focus", "1");
    if (firstSearchParam(params.run) === "1") favouriteParams.set("run", "1");
    const suffix = favouriteParams.toString();
    redirect(suffix ? `/favourites?${suffix}` : "/favourites");
  }

  if (initialSearchMode === "differentials") {
    const differentialParams = new URLSearchParams();
    const query = firstSearchParam(params.q)?.trim();
    if (query) differentialParams.set("q", query);
    if (firstSearchParam(params.focus) === "1") differentialParams.set("focus", "1");
    if (firstSearchParam(params.run) === "1") differentialParams.set("run", "1");
    const suffix = differentialParams.toString();
    redirect(suffix ? `/differentials?${suffix}` : "/differentials");
  }

  if (initialSearchMode === "dsm") {
    const query = firstSearchParam(params.q)?.trim();
    redirect(
      appModeHomeHref("dsm", {
        query,
        focus: firstSearchParam(params.focus) === "1",
        run: firstSearchParam(params.run) === "1",
      }),
    );
  }

  if (initialSearchMode === "specifiers") {
    const specifierParams = new URLSearchParams();
    const query = firstSearchParam(params.q)?.trim();
    if (query) specifierParams.set("q", query);
    if (firstSearchParam(params.focus) === "1") specifierParams.set("focus", "1");
    if (firstSearchParam(params.run) === "1") specifierParams.set("run", "1");
    const suffix = specifierParams.toString();
    redirect(suffix ? `/specifiers?${suffix}` : "/specifiers");
  }

  if (initialSearchMode === "formulation") {
    const formulationParams = new URLSearchParams();
    const query = firstSearchParam(params.q)?.trim();
    if (query) formulationParams.set("q", query);
    if (firstSearchParam(params.focus) === "1") formulationParams.set("focus", "1");
    if (firstSearchParam(params.run) === "1") formulationParams.set("run", "1");
    const suffix = formulationParams.toString();
    redirect(suffix ? `/formulation?${suffix}` : "/formulation");
  }

  return <HomePageClient initialMode={initialSearchMode} />;
}
