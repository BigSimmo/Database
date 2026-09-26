import Link from "next/link";

import type { OwnerToday } from "@/lib/developer-area/owner-today";

const LINK_CLASS =
  "flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const LIST_HEADING_CLASS = "text-sm font-semibold text-[color:var(--text-heading)]";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function formatReviewBy(date: string | null) {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Perth",
  });
}

/**
 * What is waiting on the owner, first on the page. Every figure comes from a
 * committed file, so it is as current as the deployed build and never implies a
 * live read it did not make.
 */
export function OwnerTodaySection({ today }: { today: OwnerToday }) {
  const { decisions, privacy, uncontrolledHazards } = today;

  return (
    <div className="grid gap-4" data-testid="owner-panel-today">
      <p className="text-sm text-[color:var(--text-muted)]" data-testid="owner-panel-today-summary">
        <span className="nums">{plural(decisions.length, "decision", "decisions")}</span> waiting on you ·{" "}
        <span className="nums">{plural(privacy.length, "privacy item", "privacy items")}</span> not yet verified ·{" "}
        <span className="nums">{plural(uncontrolledHazards, "clinical risk", "clinical risks")}</span> with no control
      </p>

      <section aria-labelledby="owner-panel-decisions" className="grid gap-2">
        <h3 id="owner-panel-decisions" className={LIST_HEADING_CLASS}>
          Decisions for you
        </h3>
        {decisions.length === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)]">No task list item is marked as waiting on you.</p>
        ) : (
          <ul className="grid gap-2">
            {decisions.map((item) => (
              <li key={item.id}>
                <Link
                  href="/mockups/development/ledger"
                  className={LINK_CLASS}
                  data-testid={`owner-panel-decision-${item.id}`}
                >
                  <span className="text-[color:var(--text)]">{item.summary}</span>
                  <span className="nums shrink-0 text-xs text-[color:var(--text-muted)]">
                    {item.priority} · {item.id}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-[color:var(--text-muted)]">
          Picked from task list items whose title says they wait on the owner. An item worded differently will not
          appear here.
        </p>
      </section>

      <section aria-labelledby="owner-panel-privacy" className="grid gap-2">
        <h3 id="owner-panel-privacy" className={LIST_HEADING_CLASS}>
          Privacy items not yet verified
        </h3>
        {privacy.length === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)]">Every privacy register item is verified.</p>
        ) : (
          <ul className="grid gap-1" data-testid="owner-panel-privacy-list">
            {privacy.map((item) => {
              const reviewBy = formatReviewBy(item.reviewBy);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-[color:var(--border)] py-2 text-sm last:border-b-0"
                >
                  <span className="text-[color:var(--text)]">{item.label}</span>
                  <span className="nums text-xs text-[color:var(--text-muted)]">
                    {item.status === "partial" ? "Partly done" : "Pending"}
                    {reviewBy ? ` · review by ${reviewBy}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        <Link href="/mockups/development/hazards" className={LINK_CLASS} data-testid="owner-panel-hazards-link">
          <span className="text-[color:var(--text)]">Clinical risks with no control</span>
          <span className="nums text-[color:var(--text-muted)]">{uncontrolledHazards}</span>
        </Link>
        <Link
          href="/mockups/development/clinical-sign-off"
          className={LINK_CLASS}
          data-testid="owner-panel-sign-off-link"
        >
          <span className="text-[color:var(--text)]">Records waiting for your sign-off</span>
          <span aria-hidden="true" className="text-[color:var(--text-muted)]">
            ›
          </span>
        </Link>
        <Link href="/mockups/development/ingestion" className={LINK_CLASS} data-testid="owner-panel-uploads-link">
          <span className="text-[color:var(--text)]">Uploads and indexing</span>
          <span aria-hidden="true" className="text-[color:var(--text-muted)]">
            ›
          </span>
        </Link>
        <Link href="/mockups/development/settings" className={LINK_CLASS} data-testid="owner-panel-settings-link">
          <span className="text-[color:var(--text)]">Settings check</span>
          <span aria-hidden="true" className="text-[color:var(--text-muted)]">
            ›
          </span>
        </Link>
      </div>
    </div>
  );
}
