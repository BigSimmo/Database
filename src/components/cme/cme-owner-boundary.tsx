"use client";
import { Fragment, type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CmeOfflineBanner } from "@/components/cme/cme-offline-banner";
import { useAuthSession } from "@/lib/supabase/client";

function subscribeConnectivity(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getConnectivitySnapshot() {
  return navigator.onLine;
}

function getServerConnectivitySnapshot() {
  return true;
}

type CmeOwnerBoundaryProps = {
  readonly serverOwnerId: string | null;
  readonly serverAuthVerified: boolean;
  /** Set only by the server's explicit synthetic demo environment. */
  readonly demoMode: boolean;
  readonly children: ReactNode;
};

/** A client auth change does not replace cached Server Component children by itself. */
export function CmeOwnerBoundary({ serverOwnerId, serverAuthVerified, demoMode, children }: CmeOwnerBoundaryProps) {
  const isOnline = useSyncExternalStore(subscribeConnectivity, getConnectivitySnapshot, getServerConnectivitySnapshot);
  const isOffline = !isOnline;
  const auth = useAuthSession();
  const router = useRouter();
  const clientOwnerId = auth.status === "authenticated" ? (auth.session?.user.id ?? null) : null;
  const resolved =
    (auth.status === "authenticated" && clientOwnerId !== null) ||
    auth.status === "signed_out" ||
    auth.status === "expired";
  const previousOwner = useRef(serverOwnerId);
  const lastMismatch = useRef<string | null>(null);

  useEffect(() => {
    if (demoMode || !resolved) return;
    const identityChanged = previousOwner.current !== clientOwnerId;
    previousOwner.current = clientOwnerId;
    const mismatch = !serverAuthVerified || serverOwnerId !== clientOwnerId;
    const pair = JSON.stringify([serverAuthVerified, serverOwnerId, clientOwnerId]);
    // Refresh once per transition/mismatched response, including an old response
    // arriving after another account switch. Never retry endlessly on an outage.
    if (identityChanged || (mismatch && lastMismatch.current !== pair)) {
      lastMismatch.current = mismatch ? pair : null;
      router.refresh();
    } else if (!mismatch) {
      lastMismatch.current = null;
    }
  }, [clientOwnerId, demoMode, resolved, router, serverAuthVerified, serverOwnerId]);

  if (demoMode) return <Fragment key="synthetic-demo">{children}</Fragment>;
  if (serverAuthVerified && resolved && clientOwnerId === serverOwnerId) {
    // The key comes from the verified SERVER identity, never a new client owner
    // applied to old children. Unmounting also discards the previous owner's drafts.
    return (
      <Fragment key={serverOwnerId ?? "signed-out"}>
        <CmeOfflineBanner />
        {children}
      </Fragment>
    );
  }

  const signedOut = auth.status === "signed_out" || auth.status === "expired";
  const unavailable = !serverAuthVerified || auth.status === "error" || auth.status === "unconfigured";
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6" data-testid="cme-owner-boundary">
      <p role="status">
        {signedOut
          ? "Your private CPD record is hidden. Sign in to continue."
          : isOffline
            ? "You are offline. Connect to view or update your private CPD record."
            : unavailable
              ? "Your session could not be verified. Your private CPD record is hidden."
              : "Checking your CPD session…"}
      </p>
      {isOffline || unavailable ? (
        <button type="button" className="mt-3 min-h-tap underline" onClick={() => window.location.reload()}>
          {isOffline ? "Try again" : "Refresh page"}
        </button>
      ) : auth.status === "authenticated" ? (
        <button type="button" className="mt-3 min-h-tap underline" onClick={() => router.refresh()}>
          Refresh CPD
        </button>
      ) : null}
    </section>
  );
}
