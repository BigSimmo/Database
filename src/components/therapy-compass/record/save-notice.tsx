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
    <p
      role="status"
      aria-live="polite"
      className={
        notice
          ? "m-0 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)]"
          : "sr-only"
      }
    >
      {notice}
    </p>
  );
}
