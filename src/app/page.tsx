import { ClinicalDashboard } from "@/components/clinical-dashboard";
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
  const requestedQuery = firstSearchParam(params.q)?.trim() ?? "";
  const requestedFocus = firstSearchParam(params.focus);
  const requestedRun = firstSearchParam(params.run);
  const initialSearchMode: AppModeId =
    isAppModeId(requestedMode) && isAppModeVisible(requestedMode) ? requestedMode : "answer";

  return (
    <ClinicalDashboard
      initialSearchMode={initialSearchMode}
      initialQuery={requestedQuery}
      focusSearch={requestedFocus === "1"}
      autoRunSearch={requestedRun === "1"}
    />
  );
}
