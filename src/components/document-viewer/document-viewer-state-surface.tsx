import { ArrowLeft, FileQuestion, Loader2, LockKeyhole, RefreshCw, WifiOff } from "lucide-react";

import { ContextualBackLink } from "@/components/contextual-back-link";
import { cn, floatingControl, panel } from "@/components/ui-primitives";

const secondaryButton = floatingControl;

export type DocumentViewerShellState = "loading" | "ready" | "auth-required" | "offline" | "error";

export function DocumentViewerStateSurface({
  state,
  message,
  documentHomeHref,
  onRetry,
}: {
  state: Exclude<DocumentViewerShellState, "ready">;
  message: string | null;
  documentHomeHref: string;
  onRetry: () => void;
}) {
  const config =
    state === "loading"
      ? {
          icon: Loader2,
          title: "Opening document",
          description: "Loading source details and preparing the document preview.",
          tone: "text-[color:var(--clinical-accent)]",
        }
      : state === "auth-required"
        ? {
            icon: LockKeyhole,
            title: "Sign in to open this document",
            description: message ?? "This source is private. Sign in from the header, then try again.",
            tone: "text-[color:var(--clinical-accent)]",
          }
        : state === "offline"
          ? {
              icon: WifiOff,
              title: "This document is unavailable offline",
              description: "Reconnect to load the source details and preview, then try again.",
              tone: "text-[color:var(--warning)]",
            }
          : {
              icon: FileQuestion,
              title: "We couldn't open this document",
              description:
                message ??
                "The source details were incomplete or unavailable. Retry the request or return to Documents.",
              tone: "text-[color:var(--danger)]",
            };
  const Icon = config.icon;
  const loading = state === "loading";
  const retryable = state === "error" || state === "offline";

  return (
    <section
      data-testid="document-viewer-state"
      data-viewer-state={state}
      role={state === "error" || state === "offline" ? "alert" : "status"}
      aria-live={state === "error" || state === "offline" ? "assertive" : "polite"}
      className="mx-auto grid min-h-[min(34rem,68dvh)] w-full max-w-[1440px] place-items-start px-3 py-5 sm:place-items-center sm:px-4 sm:py-8 lg:px-8"
    >
      <div className={cn(panel, "w-full max-w-2xl overflow-hidden p-5 sm:p-7")}>
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-xl bg-[color:var(--surface-subtle)]",
              config.tone,
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn("size-icon-lg", loading && "animate-spin motion-reduce:animate-none")}
            />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[color:var(--text-heading)] sm:text-xl">{config.title}</h2>
            <p className="mt-1 max-w-prose text-sm leading-6 text-[color:var(--text-muted)]">{config.description}</p>
          </div>
        </div>
        {!loading ? (
          <div className="mt-5 flex flex-col gap-2 border-t border-[color:var(--border)] pt-4 sm:flex-row sm:flex-wrap">
            {retryable ? (
              <button type="button" onClick={onRetry} className={cn(secondaryButton, "min-h-tap justify-center")}>
                <RefreshCw aria-hidden="true" className="size-icon-sm" />
                Try again
              </button>
            ) : null}
            <ContextualBackLink
              fallbackHref={documentHomeHref}
              className={cn(secondaryButton, "min-h-tap justify-center")}
              aria-label="Return to Documents"
            >
              <ArrowLeft aria-hidden="true" className="size-icon-sm" />
              Document library
            </ContextualBackLink>
          </div>
        ) : null}
      </div>
    </section>
  );
}
