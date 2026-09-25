/**
 * #358YM0: demo mode fills Favourites with fixtures ("last opened Today 08:44",
 * preset sets) that are not the clinician's own history. Every surface that shows
 * one marks it with this tag, the same idea as the Ward Flow sidebar's `example`
 * tag. Production never shows fixtures (they are gated on demo mode).
 */
export const FAVOURITE_EXAMPLES_NOTICE = "Example favourites shown in demo mode";

export function FavouriteExampleTag() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-[color:var(--border)] px-1.5 text-2xs font-semibold leading-4 text-[color:var(--text-muted)]">
      Example
    </span>
  );
}
