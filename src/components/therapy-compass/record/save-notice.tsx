/**
 * The live region that announces the result of a save.
 *
 * It lives in the page rather than beside the control that triggers it: Save is
 * in the record header, and on a phone that header is portalled into the
 * universal chrome's collapse row, which scroll-hides. A status message inside
 * it would be carried off-screen at the moment it had something to say.
 */
export function TherapySaveNotice({ notice }: { notice: string | null }) {
  return (
    <>
      {notice ? (
        <p className="m-0 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)]">
          {notice}
        </p>
      ) : null}
      {/* Always-hidden announcer: SPEC.md §9.2 forbids aria-live on the visible
          box above, which used to carry it directly. */}
      <span role="status" aria-live="polite" className="sr-only">
        {notice}
      </span>
    </>
  );
}
