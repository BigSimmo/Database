import type { LedgerOpenItem } from "@/lib/developer-area/ledger-snapshot";

/**
 * Priority is "how much this matters", and it is rendered as a *filled* pill.
 * Acuity — "how soon to start" — is a different scale on a different table, and
 * the queue renders it as an outlined chip carrying a plain-English descriptor.
 * The two treatments are deliberately unalike: a shared badge would read the
 * two P1 rows and the one A1 queue entry as a single urgent set of three, when
 * they are three different items on two unrelated scales.
 */
const PRIORITY_CLASS: Record<string, string> = {
  P1: "bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  P2: "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
  P3: "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
};

/** A priority the ledger has not used before still gets a legible badge. */
const UNKNOWN_PRIORITY_CLASS = "bg-[color:var(--surface-subtle)] text-[color:var(--text-heading)]";

/**
 * Progressive detail. Native `<details>` keeps this a Server Component with no
 * client JavaScript, gives correct keyboard and screen-reader behaviour for
 * free, and is not a `<button>` — so `require-button-wiring` does not apply.
 *
 * It is a readability device, not a data-hiding one: the longest detail cell in
 * the committed snapshot is roughly 7,800 characters, so rendering 67 of them
 * inline would make the page unscannable — but every character stays in the
 * HTML whether the disclosure is open or shut, and find-in-page and assistive
 * technology can still reach it.
 */
export function LedgerItem({ item }: { item: LedgerOpenItem }) {
  return (
    <li
      data-testid={`developer-ledger-item-${item.id.replace("#", "")}`}
      className="grid gap-2 rounded-xl border border-[color:var(--border)] p-4"
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-xs text-[color:var(--text-muted)]">{item.id}</span>
        <span
          className={`rounded-lg px-2 py-0.5 text-xs font-bold ${PRIORITY_CLASS[item.priority] ?? UNKNOWN_PRIORITY_CLASS}`}
        >
          {item.priority}
        </span>
        <span className="rounded-lg border border-[color:var(--border)] px-2 py-0.5 text-xs text-[color:var(--text-muted)]">
          {item.type}
        </span>
      </div>
      <p className="text-sm leading-6 text-[color:var(--text-heading)]">{item.summary}</p>
      <details>
        <summary className="flex min-h-12 cursor-pointer items-center text-xs font-bold text-[color:var(--text-muted)]">
          Detail and source
        </summary>
        <p className="mt-2 text-xs leading-6 text-[color:var(--text-muted)]">{item.detail}</p>
        <p className="mt-1 text-xs text-[color:var(--text-muted)]">
          Source: {item.source} · added {item.added}
        </p>
      </details>
    </li>
  );
}
