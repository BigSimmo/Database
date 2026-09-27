"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export type SentReceipt = { message: string; undo?: () => Promise<void> };

/** Five seconds to reverse a newly sent request. A failed reversal stays visible. */
export function RosterSentBar({ receipt, clear }: { receipt: SentReceipt | null; clear: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousReceipt, setPreviousReceipt] = useState(receipt);
  if (receipt !== previousReceipt) {
    setPreviousReceipt(receipt);
    setError(null);
    setBusy(false);
  }
  useEffect(() => {
    if (!receipt || busy || error) return;
    const timer = window.setTimeout(clear, 5_000);
    return () => window.clearTimeout(timer);
  }, [receipt, clear, busy, error]);
  if (!receipt) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
    >
      <span>{error ?? receipt.message}</span>
      {receipt.undo ? (
        <Button
          variant="secondary"
          busy={busy}
          onClick={() => {
            setBusy(true);
            void receipt.undo!().then(clear, () => {
              setError("Could not undo. Check the request before trying again.");
              setBusy(false);
            });
          }}
        >
          Undo
        </Button>
      ) : null}
    </div>
  );
}
