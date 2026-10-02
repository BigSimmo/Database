import { InformationPageShell } from "@/components/information-page-shell";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { Skeleton } from "@/components/ui-primitives";

/**
 * Roster pages are narrow and top-aligned: an identity tile and title, then
 * modules. The loading state keeps that shape so nothing jumps when the page
 * arrives (the centred mode-home skeleton did).
 */
function RosterLoadingSkeleton() {
  return (
    <InformationPageShell as="div" width="narrow" testId="roster-route-loading">
      <div role="status" aria-label="Loading" className="grid min-w-0 gap-5">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="grid min-w-0 flex-1 gap-1.5 pt-0.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        </div>
        <ModeModuleSkeleton rows={3} twoLine />
        <ModeModuleSkeleton rows={2} />
        <span className="sr-only">Loading</span>
      </div>
    </InformationPageShell>
  );
}

export default function Loading() {
  return <RosterLoadingSkeleton />;
}
