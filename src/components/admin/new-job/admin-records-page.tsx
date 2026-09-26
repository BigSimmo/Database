"use client";

import { Ellipsis } from "lucide-react";
import { useMemo, useState } from "react";

import { cardSurface, cardPadding } from "@/components/card-recipes";
import { InformationPageBreadcrumbs, InformationPageShell } from "@/components/information-page-shell";
import { Sheet } from "@/components/ui/sheet";
import { cn, eyebrowText, IconButton, textMuted } from "@/components/ui-primitives";
import { buildLeavingPack, type LeavingPackRecord } from "@/lib/admin/leaving-pack";
import { adminLoadState, selectAdminOwnEntries } from "@/lib/admin/own-entries";
import { formatDateEcho, formatRecordedDate, formatUpdatedMonth } from "@/lib/admin/renewal-dates";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import { complianceExpiresOn } from "@/lib/on-call/compliance";
import { OnCallLoadFailed } from "@/components/on-call/on-call-load-failed";
import { useOnCallEntries } from "@/lib/on-call/entry-store";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";

function detailString(record: LeavingPackRecord, key: string): string | null {
  const details = record.details;
  const value = typeof details === "object" && details !== null ? (details as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" && value.trim() ? value : null;
}

function RecordRow({ record }: { record: LeavingPackRecord }) {
  const expiresOn = complianceExpiresOn(record);
  const issuer = detailString(record, "issuingBody") ?? detailString(record, "role");
  const recordedLine = expiresOn
    ? `Recorded as ${formatRecordedDate(expiresOn)}`
    : record.lastVerifiedAt
      ? `Updated ${formatUpdatedMonth(record.lastVerifiedAt)}`
      : "Not recorded yet";
  return (
    <li
      className="border-b border-[color:var(--border)] px-3 py-2 last:border-b-0"
      data-testid={`admin-records-row-${record.id}`}
    >
      <span className="block break-words text-sm font-medium text-[color:var(--text-heading)]">{record.title}</span>
      <span className={cn(textMuted, "block break-words text-sm")}>
        {issuer ? `${issuer} · ` : ""}
        {recordedLine}
      </span>
    </li>
  );
}

function RecordGroup({ label, records }: { label: string; records: readonly LeavingPackRecord[] }) {
  if (records.length === 0) return null;
  return (
    <section className="grid gap-2" aria-label={label}>
      <div className="flex items-center justify-between px-1">
        <h2 className={eyebrowText}>{label}</h2>
        <span className={cn(textMuted, "nums text-xs")}>{records.length} recorded</span>
      </div>
      <ul className={cn(cardSurface, "overflow-hidden")}>
        {records.map((record) => (
          <RecordRow key={record.id} record={record} />
        ))}
      </ul>
    </section>
  );
}

function plainTextSummary(pack: ReturnType<typeof buildLeavingPack>): string {
  const lines = [
    "Your Admin records",
    pack.note,
    "",
    "Renewals",
    ...pack.renewals.map((record) => `- ${record.title}`),
    "",
    "Admin",
    ...pack.adminEntries.map((record) => `- ${record.title}`),
    "",
    "Contacts",
    ...pack.contacts.map((record) => `- ${record.title}`),
  ];
  return lines.join("\n");
}

/**
 * "Your Admin records" (owner-approved behaviour): an on-screen page, never a
 * download. It reuses `buildLeavingPack`'s three groups — the same data a
 * downloaded pack would hold — so the reader always sees exactly what would
 * leave with them. Copy and Print sit behind the ••· menu; there is no
 * primary command on this page.
 */
export function AdminRecordsPage({ now: nowProp }: { now?: Date } = {}) {
  const state = useOnCallEntries();
  const mountedAt = useMemo(() => new Date(), []);
  const now = nowProp ?? mountedAt;
  const [menuOpen, setMenuOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const loadState = adminLoadState(state);
  const own = useMemo(() => selectAdminOwnEntries(state), [state]);
  const pack = useMemo(() => buildLeavingPack({ ownEntries: own, now }), [own, now]);

  function copy() {
    void copyTextToClipboard(plainTextSummary(pack)).then(
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
          <p className={cn(textMuted, "text-sm")} data-testid="admin-records-subtitle">
            As you recorded them · {formatDateEcho(perthCalendarDate(now))}
          </p>
        </div>
        <IconButton label="More actions" icon={Ellipsis} onClick={() => setMenuOpen(true)} className="shrink-0" />
      </div>

      {loadState === "failed" ? (
        <OnCallLoadFailed reason={state.loadError} onRetry={state.retry} testId="admin-records-load-failed" />
      ) : (
        <>
          <RecordGroup label="Renewals" records={pack.renewals} />
          <RecordGroup label="Admin" records={pack.adminEntries} />
          <RecordGroup label="Contacts" records={pack.contacts} />
          {pack.renewals.length + pack.adminEntries.length + pack.contacts.length === 0 ? (
            <p className={cn(cardSurface, cardPadding.compact, textMuted, "text-sm")} data-testid="admin-records-empty">
              Nothing recorded yet.
            </p>
          ) : null}
        </>
      )}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Your Admin records">
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
