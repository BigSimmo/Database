import { cn } from "@/components/ui-primitives";

/**
 * Official third-party sign-in brand marks.
 *
 * These reproduce the vendors' real logos (not text placeholders or lucide
 * lookalikes) so the OAuth buttons match Apple / Google / Microsoft brand
 * guidelines. They are decorative — the button always carries a visible text
 * label — so each mark is `aria-hidden`. Consumers size the mark via
 * `className` (e.g. `h-5 w-5`).
 *
 * Colour notes:
 * - Apple's glyph is monochrome and uses `currentColor`, so it tracks the
 *   button text colour and stays legible in light, dark, and forced-colors.
 * - Google and Microsoft keep their fixed brand colours in every theme, as the
 *   brand guidelines require; they remain readable on the button surfaces.
 */

type BrandIconProps = { className?: string };

export function AppleBrandIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <path
        fill="currentColor"
        d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.04.28.04.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"
      />
    </svg>
  );
}

export function GoogleBrandIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

export function MicrosoftBrandIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 23 23"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M12 1h10v10H12z" />
      <path fill="#00A4EF" d="M1 12h10v10H1z" />
      <path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  );
}

export type SsoProvider = "Apple" | "Google" | "Microsoft";

/** Renders the official brand mark for a given SSO provider. */
export function ProviderBrandIcon({ provider, className }: { provider: SsoProvider; className?: string }) {
  if (provider === "Apple") return <AppleBrandIcon className={className} />;
  if (provider === "Google") return <GoogleBrandIcon className={className} />;
  return <MicrosoftBrandIcon className={className} />;
}

/**
 * Compact provider mark used in the settings sign-in list: Microsoft's four-colour
 * grid and a lettered tile for Apple/Google. Distinct from {@link ProviderBrandIcon}
 * (the full vendor logos); it lives here so its fixed brand colours sit with the
 * other brand artwork. Decorative — the button always carries a visible label.
 */
export function ProviderBrandMark({ provider }: { provider: SsoProvider }) {
  if (provider === "Microsoft") {
    return (
      <span
        className="grid h-7 w-7 shrink-0 grid-cols-2 gap-0.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-inset)]"
        aria-hidden="true"
      >
        <span className="bg-[#f25022]" />
        <span className="bg-[#7fba00]" />
        <span className="bg-[#00a4ef]" />
        <span className="bg-[#ffb900]" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-base font-bold leading-none shadow-[var(--shadow-inset)]",
        provider === "Apple" ? "text-[color:var(--text-heading)]" : "text-[#4285f4]",
      )}
    >
      {provider === "Apple" ? "A" : "G"}
    </span>
  );
}
