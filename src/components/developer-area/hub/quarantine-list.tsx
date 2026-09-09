import { CARD_CLASS, META_CLASS, MONO_CLASS, ROW_CLASS } from "@/components/developer-area/hub/panel-primitives";
import { isQuarantineExpired } from "@/lib/developer-area/repo-awareness-snapshot";
import type { QuarantinedTest } from "@/lib/developer-area/repo-awareness-types";

/**
 * Lives outside the page module because a Next.js App Router `page.tsx` may
 * only export a fixed set of framework-recognised names (`default`,
 * `metadata`, `viewport`, `dynamic`, and friends) — the generated
 * `.next/types/app` page-validator types hard-fail the build on any other
 * export, a constraint invisible to `typecheck:source` (source-only
 * `tsconfig.typecheck.json`), Vitest (imports the module directly), and lint
 * (no rule for it). `QuarantineList` was exported directly from
 * `test-health/page.tsx` and unit-tested with a fixture — the only coverage
 * of the page's primary content, since `test_health.quarantined` is `[]` on
 * live data — so it moved here rather than losing that test.
 *
 * No `"use client"`, and nothing imported here carries one either: the page
 * that renders this is a Server Component, and a client boundary here would
 * pull it into the client bundle with no gate before `npm run build` able to
 * see the mistake.
 *
 * `QuarantineList` takes `now` as a parameter, rather than calling `new
 * Date()` itself, so a test can render both sides of the expiry boundary
 * (`isQuarantineExpired`) without faking the system clock.
 *
 * Every field on `QuarantinedTest` (id, title, spec, reason, owner,
 * reproduction, first_seen, last_seen, expires, tracking) is rendered
 * unconditionally as plain text below — none of them drive a branch, so there
 * is no enumerated value here that could be silently dropped the way an
 * unrecognised `page.area` or documentation `section` is handled on the
 * sibling pages. The only branch in this component is on `expired`, a boolean
 * *computed* from `expires` via `isQuarantineExpired`, not a raw field value
 * with its own domain of recognised/unrecognised states.
 */
export function QuarantineList({ entries, now }: { entries: readonly QuarantinedTest[]; now: Date }) {
  return (
    <ul data-testid="developer-test-health-list" className="grid gap-3">
      {entries.map((entry) => {
        const expired = isQuarantineExpired(entry, now);
        return (
          <li key={entry.id} data-testid={`developer-test-health-entry-${entry.id}`} className={CARD_CLASS}>
            <div className={ROW_CLASS}>
              <span className={MONO_CLASS}>{entry.id}</span>
              {expired ? (
                <span className="rounded-full border-2 border-[color:var(--danger)] px-2 py-0.5 text-xs font-bold text-[color:var(--text-heading)]">
                  expired {entry.expires}
                </span>
              ) : (
                <span className={META_CLASS}>· lapses {entry.expires}</span>
              )}
            </div>
            <p className="text-sm leading-6 text-[color:var(--text-heading)]">{entry.title}</p>
            <p className={META_CLASS}>
              {entry.spec} · {entry.owner} · first seen {entry.first_seen}, last seen {entry.last_seen}
            </p>
            <p className="text-sm leading-6 text-[color:var(--text-heading)]">{entry.reason}</p>
            <p className={META_CLASS}>Reproduce: {entry.reproduction}</p>
            <p className={META_CLASS}>Tracked in {entry.tracking}</p>
          </li>
        );
      })}
    </ul>
  );
}
