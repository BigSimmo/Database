"use client";
// Shown once per device; the dismissal flag holds no personal data.
import { useEffect, useState, useSyncExternalStore } from "react";
import { FnButton } from "@/components/first-nations/kit";
import { Sheet } from "@/components/ui/sheet";

const KEY = "first-nations-primer-dismissed";
export const PRIMER_EVENT = "first-nations:open-primer";

const noSubscription = () => () => {};

function dismissedOnThisDevice(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    // Storage refused (a private window): show the primer, since nothing records that it was seen.
    return false;
  }
}

export function Primer() {
  // The server render counts as dismissed, so the sheet never flashes open before the browser has looked.
  const dismissedStored = useSyncExternalStore(noSubscription, dismissedOnThisDevice, () => true);
  const [dismissed, setDismissed] = useState(false);
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const reopen = () => setReopened(true);
    window.addEventListener(PRIMER_EVENT, reopen);
    return () => window.removeEventListener(PRIMER_EVENT, reopen);
  }, []);

  const close = () => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // Private windows may refuse storage; the primer simply shows again next time.
    }
    setDismissed(true);
    setReopened(false);
  };

  const open = reopened || (!dismissedStored && !dismissed);
  return (
    <Sheet open={open} onClose={close} title="About First Nations">
      <ul className="grid gap-2 text-sm-minus text-[color:var(--text)]">
        <li>A reference and contacts tool, not clinical decision support.</li>
        <li>Cultural content shows its source and awaits your service&apos;s Aboriginal health team.</li>
        <li>Nothing about any patient is saved or sent.</li>
      </ul>
      <div className="mt-3">
        <FnButton filled label="Got it" onClick={close} />
      </div>
    </Sheet>
  );
}
