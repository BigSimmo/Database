import { HomePageClient } from "@/app/home-page-client";
import { isAppModeId, isAppModeVisible, type AppModeId } from "@/lib/app-modes";

type HomeProps = {
  searchParams?: Promise<{
    mode?: string | string[];
    q?: string | string[];
    focus?: string | string[];
    run?: string | string[];
  }>;
};

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : {};
  const requestedMode = firstSearchParam(params.mode);
  const initialSearchMode: AppModeId =
    isAppModeId(requestedMode) && isAppModeVisible(requestedMode) ? requestedMode : "answer";

  return <HomePageClient initialMode={initialSearchMode} />;
}
