"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { ModeNotice } from "@/components/mode-kit/notice";
import { Button, buttonFaceClass } from "@/components/ui/button";

export type CmeLoadState = "ready" | "unconfigured" | "signed-out" | "unavailable" | "offline" | "error";

// Spec §7, approved wording. Real apostrophes (standard v13 §1).
const SIGNED_OUT_LINE = "It is linked to your account only, and it is not shared with your health service.";
const OFFLINE_LINE = "Your CPD record isn’t kept on this phone. It opens again as soon as you’re back online.";
const ERROR_LINE = "Nothing was changed. Try again, or come back in a few minutes.";
const EMPTY_LINE = "Choose your CPD home in Set up, then tap + Log.";

/** One state inside the kit's notice: its title at 500, an optional line, then its one action. */
function StateNotice({
  testId,
  title,
  line,
  action,
}: {
  readonly testId: string;
  readonly title: string;
  readonly line?: string;
  readonly action?: ReactNode;
}) {
  return (
    <ModeNotice testId={testId}>
      <span className="grid gap-2">
        <span className="font-medium text-[color:var(--text-heading)]">{title}</span>
        {line ? <span>{line}</span> : null}
        {action ? <span className="flex flex-wrap gap-2">{action}</span> : null}
      </span>
    </ModeNotice>
  );
}

/**
 * CPD's one state module (spec §7, standard §9). It picks the words; the shared
 * `ModeNotice` draws them, so every CPD page shows a state the same way.
 *
 * - `unavailable` is the server loaders' name for "the record could not be
 *   read" (an outage or an unexpected throw). It renders exactly as `error`,
 *   so the loaders' contract does not change.
 * - `offline` and `error` carry an outlined 48 px Try again. It calls
 *   `onRetry` when the caller has one (the segment error boundary passes
 *   Next's `retry`); a server-rendered notice cannot pass a function, so it
 *   reloads the page.
 * - `unconfigured` (no confirmed targets for the year yet) is spec §7's empty
 *   state: one line and where to start, with an outlined link to Set up.
 * - `heading` is the page's own title, kept above the state so the page never
 *   loses its header.
 */
export function CmeStateNotice({
  state,
  year,
  heading,
  onRetry,
}: {
  readonly state: Exclude<CmeLoadState, "ready">;
  readonly year: number;
  readonly heading?: string;
  readonly onRetry?: () => void;
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const tryAgain = (
    <Button variant="secondary" testId="cme-state-retry" onClick={onRetry ?? (() => window.location.reload())}>
      Try again
    </Button>
  );

  let notice: ReactNode;
  if (state === "signed-out") {
    notice = (
      <>
        <StateNotice
          testId="cme-signed-out"
          title="Sign in to open your private CPD record."
          line={SIGNED_OUT_LINE}
          action={
            <Button variant="primary" onClick={() => setAccountOpen(true)}>
              Sign in
            </Button>
          }
        />
        <AccountSetupDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
      </>
    );
  } else if (state === "offline") {
    notice = <StateNotice testId="cme-offline" title="You’re offline." line={OFFLINE_LINE} action={tryAgain} />;
  } else if (state === "error" || state === "unavailable") {
    notice = (
      <StateNotice testId="cme-error" title="Your CPD record didn’t open." line={ERROR_LINE} action={tryAgain} />
    );
  } else {
    notice = (
      <StateNotice
        testId="cme-unconfigured"
        title={EMPTY_LINE}
        action={
          <Link href={`/cme/setup?year=${year}`} className={buttonFaceClass({ variant: "secondary" })}>
            Open Set up
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {heading ? <h1 className="text-xl font-semibold text-[color:var(--text)]">{heading}</h1> : null}
      {notice}
    </div>
  );
}
