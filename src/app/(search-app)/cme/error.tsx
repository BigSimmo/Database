"use client";

import { useEffect } from "react";

import { CmeStateNotice } from "@/components/cme/cme-state-notice";
import { cpdYearOf } from "@/lib/cme/cpd-year";
import { cmeStateFromError } from "@/lib/cme/load-state";

/**
 * Anything that throws while a CPD page renders lands here rather than in the
 * app-wide "Something went wrong in this area" boundary: the CPD offline or
 * error state, with Try again re-fetching the segment. It sits inside the CPD
 * layout, so the owner boundary still guards what is shown. The error goes to
 * the console for support, and its message is never displayed. React renders
 * error boundaries only in the browser, so reading `navigator` here cannot
 * mismatch a server render.
 */
export default function CmeError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("Unhandled runtime error captured in CPD segment:", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <CmeStateNotice state={cmeStateFromError(error)} year={cpdYearOf(new Date())} onRetry={retry} />
    </main>
  );
}
