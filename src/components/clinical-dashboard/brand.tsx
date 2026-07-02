import { cn } from "@/components/ui-primitives";

/**
 * Site brand mark: teal tile with an ECG pulse line. Colours come from the
 * clinical accent tokens so the mark adapts to light/dark/forced-colors.
 * Size it via className (h-10 w-10 expanded sidebar, h-7 w-7 collapsed rail).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <rect x="2" y="2" width="44" height="44" rx="13" fill="var(--clinical-accent)" />
      <path d="M2 16C2 8.3 8.3 2 16 2h16c7.7 0 14 6.3 14 14v1H2z" fill="#fff" opacity=".08" />
      <polyline
        points="9,27 16.5,27 21,17 26,33 30,23.5 33,27 36.5,27"
        fill="none"
        stroke="var(--clinical-accent-contrast)"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="40.5" cy="27" r="2.4" fill="var(--clinical-accent-contrast)" />
    </svg>
  );
}
