"use client";

import { Ellipsis } from "lucide-react";
import { useMemo, useState } from "react";

import { cardSurface, cardPadding } from "@/components/card-recipes";
import { InformationPageBreadcrumbs, InformationPageShell } from "@/components/information-page-shell";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { Sheet } from "@/components/ui/sheet";
import { cn, eyebrowText, IconButton, textMuted } from "@/components/ui-primitives";
import { adminRecordsSections, adminRecordsText, type AdminRecordsSection } from "@/lib/admin/leaving-pack";
import { adminLoadState, selectAdminOwnEntries } from "@/lib/admin/own-entries";
import { formatDateEcho } from "@/lib/admin/renewal-dates";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import { AdminLoadFailed } from "@/components/admin/admin-load-failed";
import { useOnCallEntries } from "@/lib/on-call/entry-store";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";

function RecordGroup({ section }: { section: AdminRecordsSection }) {
  return (
    <section className="grid gap-2" aria-label={section.label}>
      <h2 className={cn(eyebrowText, "px-1")}>{section.label}</h2>
      <ul className={cn(cardSurface, "overflow-hidden")}>
        {section.rows.map((row) => (
          <li
            key={row.key}
            className="border-b border-[color:var(--border)] px-3 py-2 last:border-b-0"
            data-testid={`admin-records-row-${row.key}`}
          >
            <span className="block break-words text-sm font-medium text-[color:var(--text-heading)]">{row.title}</span>
            {row.lines.map((line) => (
              <span key={line} className={cn(textMuted, "block break-words text-sm")}>
                {line}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * "Your Admin records" (owner-approved behaviour): an on-screen page, never a
 * download. It lists `adminRecordsSections`: every renewal with its date and
 * earlier dates, what is not recorded yet, what is not for this job, the New
 * job ticks, other Admin rows and contacts. Copy writes the same lines
 * (`adminRecordsText`), dates included. Copy and Print sit behind the •••
 * menu; there is no primary command on this page.
 */
export function AdminRecordsPage({ now: nowProp }: { now?: Date } = {}) {
  const state = useOnCallEntries();
  const mountedAt = useMemo(() => new Date(), []);
  const now = nowProp ?? mountedAt;
  const [menuOpen, setMenuOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const loadState = adminLoadState(state);
  const own = useMemo(() => selectAdminOwnEntries(state), [state]);
  const sections = useMemo(() => adminRecordsSections(own), [own]);

  function copy() {
    void copyTextToClipboard(adminRecordsText(sections, now)).then(
      () => setCopyState("copied"),
      () => setCopyState("failed"),
    );
  }

  return (
    <InformationPageShell testId="admin-records-main">
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-1">
          <InformationPageBreadcrumbs
            home={{ label: "New job", href: "/admin/new-job" }}
            current="Your Admin records"
          />
          <h1 className="text-2xl font-semibold text-[color:var(--text-heading)]">Your Admin records</h1>
          <p className={cn(textMuted, "text-sm")} data-testid="admin-records-subtitle">
            As you recorded them · {formatDateEcho(perthCalendarDate(now))}
          </p>
        </div>
        {loadState === "ready" ? (
          <IconButton label="More actions" icon={Ellipsis} onClick={() => setMenuOpen(true)} className="shrink-0" />
        ) : null}
      </div>

      {loadState === "failed" ? (
        <AdminLoadFailed reason={state.loadError} onRetry={state.retry} testId="admin-records-load-failed" />
      ) : loadState === "loading" ? (
        // Design point 11: skeletons while loading, never an empty-looking page.
        <ModeModuleSkeleton rows={4} twoLine eyebrow testId="admin-records-loading" />
      ) : loadState === "signed-out" ? (
        <p
          className={cn(cardSurface, cardPadding.compact, textMuted, "text-sm")}
          data-testid="admin-records-signed-out"
        >
          Sign in to see your Admin records. They are kept for your signed-in account only.
        </p>
      ) : (
        <>
          {sections.map((section) => (
            <RecordGroup key={section.label} section={section} />
          ))}
          {sections.length === 0 ? (
            <p className={cn(cardSurface, cardPadding.compact, textMuted, "text-sm")} data-testid="admin-records-empty">
              Nothing recorded yet.
            </p>
          ) : null}
        </>
      )}

      <Sheet open={loadState === "ready" && menuOpen} onClose={() => setMenuOpen(false)} title="Your Admin records">
        <div className="grid gap-2">
          <button
            type="button"
            onClick={copy}
            data-testid="admin-records-copy"
            className="flex min-h-12 items-center rounded-lg px-2 text-left text-sm text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]"
          >
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Could not copy" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            data-testid="admin-records-print"
            className="flex min-h-12 items-center rounded-lg px-2 text-left text-sm text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]"
          >
            Print
          </button>
        </div>
      </Sheet>
    </InformationPageShell>
  );
}
