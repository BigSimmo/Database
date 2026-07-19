"use client";

/**
 * Inline gate when Favourites content would otherwise render in the dashboard
 * for a signed-out non-demo session (defense in depth; /favourites is canonical).
 */
export function FavouritesGuestGate({ onOpenAccountSetup }: { onOpenAccountSetup: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <p className="text-base font-semibold text-[color:var(--text-heading)]">Favourites are tied to your account.</p>
      <p className="mt-2 text-sm text-[color:var(--text-muted)]">Sign in or create an account to continue.</p>
      <button
        type="button"
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-[color:var(--clinical-accent)] px-4 text-sm font-extrabold text-[color:var(--clinical-accent-contrast)]"
        onClick={onOpenAccountSetup}
        data-testid="dashboard-favourites-open-account-setup"
      >
        Sign up to save favourites
      </button>
    </div>
  );
}
