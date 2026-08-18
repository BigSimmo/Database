import { categoryGlyph } from "@/lib/category-identity-icons";
import { cn } from "@/components/ui-primitives";
import type { CategoryAccent, CategoryIconKey } from "@/lib/category-identity";

/**
 * The one category icon tile.
 *
 * It replaces three near-identical implementations — `ToolIcon` in
 * `applications-launcher-page.tsx`, a second `ToolIcon` in
 * `tools-search-results-page.tsx`, and the private `iconTile` recipe in
 * `ui-primitives.tsx` — which had drifted apart on all three axes at once:
 * radius (`rounded-lg` vs `rounded-xl`), box size (`h-9` / `h-12` / `h-14` /
 * `h-tap`), and colour. The colour drift was the visible one: the launcher
 * tinted by tool area while the results page painted every tile
 * `--type-source`, so the same tool changed hue depending on how you reached it.
 *
 * Two sizes only. `sm` is the list-row tile, `md` the card tile. The 56px
 * variant the launcher card used is gone — it existed to fill a fixed
 * `min-h-[9.25rem]` card that is now content-sized.
 *
 * Colour arrives through `data-category-accent` → `--cat-*` (globals.css), not
 * through interpolated class names, which Tailwind's scanner cannot see, and
 * not through an inline `style`, which bypasses the theme contract in dark and
 * forced-colors modes.
 */
export function CategoryIconTile({
  icon,
  accent,
  size = "md",
  className,
}: {
  icon: CategoryIconKey;
  accent: CategoryAccent;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      data-category-accent={accent}
      className={cn(
        "grid shrink-0 place-items-center rounded-lg border border-[color:var(--cat-border)] bg-[color:var(--cat-soft)] text-[color:var(--cat-accent)] shadow-[var(--shadow-inset)] forced-colors:border",
        size === "sm" ? "h-9 w-9" : "h-tap w-tap",
        className,
      )}
    >
      {categoryGlyph(icon, size === "sm" ? "size-icon-lg" : "size-icon-xl")}
    </span>
  );
}
