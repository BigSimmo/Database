import { CircleAlert, RefreshCw, Square, WifiOff } from "lucide-react";
import { UtilityDrawer } from "@/components/clinical-dashboard/dashboard-shell";
import { isDeployedClinicalKb } from "@/lib/deployed-app";
import { cn, EmptyState, primaryControl } from "@/components/ui-primitives";

export function SystemNotice({
  demoMode,
  setupWarning,
  className,
}: {
  demoMode: boolean;
  setupWarning: string | null;
  className?: string;
}) {
  return (
    <UtilityDrawer
      icon={CircleAlert}
      title={demoMode ? "Demo mode" : "Setup required"}
      summary={demoMode ? "Synthetic data only; not clinical guidance." : "Configuration is needed before search."}
      mobileSummary={demoMode ? "Synthetic data" : "Setup needed"}
      className={className}
    >
      <p className="text-base-minus leading-6 text-[color:var(--warning)]">
        {demoMode
          ? "Demo mode is active with three synthetic indexed documents, citations, source cards, image captions, and document links. Synthetic data only; not clinical guidance."
          : `Configure .env.local and run supabase/schema.sql before searching. ${setupWarning}`}
      </p>
    </UtilityDrawer>
  );
}

export function DegradedNotice({ isOnline }: { isOnline: boolean }) {
  return (
    <UtilityDrawer
      icon={!isOnline ? WifiOff : CircleAlert}
      title={!isOnline ? "Offline" : "Service unavailable"}
      summary={
        !isOnline
          ? "Your browser is offline. Existing content may remain visible, but private search needs network access."
          : isDeployedClinicalKb()
            ? "The app could not reach its API. Try again in a moment."
            : "The local API did not respond. Check the app server and setup status before retrying."
      }
      mobileSummary={!isOnline ? "Offline" : "API unavailable"}
    >
      <p className="text-base-minus leading-6 text-[color:var(--warning)]">
        {!isOnline
          ? "Reconnect before refreshing source URLs or generating answers."
          : isDeployedClinicalKb()
            ? "The app will preserve the current view. If this keeps happening, check your connection and try again shortly."
            : "The app will preserve the current view. Retry after confirming the local server, Supabase, OpenAI, and worker setup."}
      </p>
    </UtilityDrawer>
  );
}

/**
 * Result pages overlay the notice from a zero-height frame and must unmount
 * that node when healthy: a hidden `h-0` box still takes the parent
 * `space-y-*` gap and inflates phone geometry.
 *
 * Centred homes on sm+ keep a 62px reserved frame on first paint even while
 * healthy. Unmounting that slot lets a late "Service unavailable" banner shove
 * the hero (~0.075 CLS, Production UI `ui-pwa` wide-phone). Filling the
 * reserved box does not change layout.
 *
 * Phone centred homes overlay instead (`h-0 overflow-visible`): the 62px band
 * sat above the cluster, sank the hero, and helped manufacture a scrollbar.
 * A late banner paints over the cluster rather than shoving it. The parent
 * idle-home column uses `max-sm:space-y-0`, so the zero-height frame cannot
 * donate a `space-y-*` gap either.
 */
export function DegradedNoticeFrame({
  visible,
  isOnline,
  reserveSpace = false,
}: {
  visible: boolean;
  isOnline: boolean;
  reserveSpace?: boolean;
}) {
  if (!visible && !reserveSpace) {
    return null;
  }

  return (
    <div
      data-testid="dashboard-degraded-notice-frame"
      data-visible={visible ? "true" : "false"}
      className={
        reserveSpace
          ? "max-sm:relative max-sm:z-10 max-sm:!mt-0 max-sm:h-0 max-sm:overflow-visible sm:min-h-[3.875rem]"
          : "relative z-10 !mt-0 h-0 overflow-visible"
      }
    >
      {visible ? (
        <>
          <span role="alert" className="sr-only">
            {!isOnline ? "Offline" : "Service unavailable"}
          </span>
          <DegradedNotice isOnline={isOnline} />
        </>
      ) : null}
    </div>
  );
}

/**
 * The notice shown after the reader stops answer generation.
 *
 * It reports on the last action rather than describing the page, so the
 * dashboard renders it with the other top-of-content notices instead of inside
 * the mode-home canvas. In the canvas it was centred as one group with the
 * `SharedHomeEmptyState` hero, which on a phone left it floating in the middle
 * of the screen under a tall empty gap (device report, 2026-08-27).
 *
 * Extracted from ClinicalDashboard so the notice's markup lives with its
 * rationale rather than adding lines to a file under a no-growth budget.
 */
export function AnswerCancelledNotice({ onRunAgain }: { onRunAgain: () => void }) {
  return (
    <EmptyState
      icon={Square}
      title="Generation stopped"
      body="No partial clinical answer was kept. You can safely run the same question again."
      live="polite"
      testId="answer-cancelled"
      actions={
        <button type="button" className={cn(primaryControl, "text-xs")} onClick={onRunAgain}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Run again
        </button>
      }
    />
  );
}
