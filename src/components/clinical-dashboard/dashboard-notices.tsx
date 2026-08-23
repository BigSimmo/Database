import { CircleAlert, WifiOff } from "lucide-react";
import { UtilityDrawer } from "@/components/clinical-dashboard/dashboard-shell";
import { isDeployedClinicalKb } from "@/lib/deployed-app";

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
 * Centred homes keep a 62px reserved frame on first paint even while healthy.
 * Unmounting that slot lets a late "Service unavailable" banner shove the
 * hero (~0.075 CLS, Production UI `ui-pwa` wide-phone). Filling the reserved
 * box does not change layout.
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
      className={reserveSpace ? "min-h-[3.875rem]" : "relative z-10 !mt-0 h-0 overflow-visible"}
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
