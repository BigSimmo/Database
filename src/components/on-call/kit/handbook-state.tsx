"use client";

import { Check, CloudOff, RotateCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { focusRing } from "@/components/card-recipes";
import { OnCallModuleSkeleton } from "@/components/on-call/kit/module-skeleton";
import {
  onCallInsetHairline,
  onCallModuleSurface,
  onCallPressable,
  onCallRowHeight,
} from "@/components/on-call/kit/recipes";
import { onCallNameText, onCallSecondaryText } from "@/components/on-call/kit/type";
import { ON_CALL_HUB_PAGE_ICONS, type OnCallHubPage } from "@/components/on-call/on-call-section-identity";
import type {
  HospitalHandbookOption,
  HospitalHandbookState,
  HospitalHandbookStatus,
} from "@/components/on-call/use-hospital-handbook";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { Button, buttonFaceClass } from "@/components/ui/button";
import { cn } from "@/components/ui-primitives";

const ON_CALL_SERVICE_HREF = "/on-call/service";

function SignInState({
  page,
  title,
  body,
  testId,
}: {
  readonly page: OnCallHubPage;
  readonly title: string;
  readonly body: string;
  readonly testId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <EmptyState
        icon={ON_CALL_HUB_PAGE_ICONS[page]}
        title={title}
        body={body}
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            Sign in
          </Button>
        }
        testId={testId}
      />
      <AccountSetupDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * The two states that need the reader to sign in. Keyed by status rather than
 * switched on, so a status name never reads as reader-facing prose to the
 * wording guard (`tests/on-call-hub-wording.test.ts`).
 */
const SIGN_IN_COPY: Partial<Record<HospitalHandbookStatus, { readonly title: string; readonly body: string }>> = {
  "signed-out": {
    title: "Hospital numbers are for signed-in members.",
    body: "Sign in to see the switchboard, wards and teams for your hospital.",
  },
  expired: {
    title: "Your session ended. Sign in again to see your hospital's numbers.",
    body: "Nothing you saved on this device has been lost.",
  },
};

/**
 * What a hub page shows while the hospital handbook is not ready, in words that
 * say what the state means and what to do (amendment 1.6). `ready` renders
 * nothing: the page draws its own modules.
 *
 * Loading keeps the modules' space with static outlines, so nothing below moves
 * when the rows arrive. `unavailable` is its own wording rather than
 * `OnCallLoadFailed`, which speaks of "your On Call entries" and would name the
 * wrong thing here.
 */
export function OnCallHandbookState({
  handbook,
  page,
}: {
  readonly handbook: HospitalHandbookState;
  readonly page: OnCallHubPage;
}) {
  const testId = `on-call-handbook-state-${handbook.status}`;
  const signIn = SIGN_IN_COPY[handbook.status];
  if (signIn) return <SignInState page={page} title={signIn.title} body={signIn.body} testId={testId} />;
  switch (handbook.status) {
    case "ready":
      return null;
    case "loading":
      return (
        <div className="grid min-w-0 gap-5" data-testid={testId}>
          <OnCallModuleSkeleton rows={2} eyebrow />
          <OnCallModuleSkeleton rows={4} twoLine eyebrow />
        </div>
      );
    case "no-service":
      return (
        <EmptyState
          icon={ON_CALL_HUB_PAGE_ICONS[page]}
          title="You are not in a hospital handbook yet."
          body="Ask your hospital's handbook admin for an invite."
          actions={
            <Link href={ON_CALL_SERVICE_HREF} className={cn(buttonFaceClass({ variant: "secondary" }), "no-underline")}>
              Manage service
            </Link>
          }
          testId={testId}
        />
      );
    case "unavailable":
      return (
        <EmptyState
          icon={CloudOff}
          title="Hospital numbers could not be loaded"
          body="The server did not answer. Try again in a moment, or ring switchboard from a hospital phone."
          actions={
            <Button type="button" variant="secondary" icon={RotateCw} onClick={handbook.retry}>
              Try again
            </Button>
          }
          testId={testId}
        />
      );
  }
  return null;
}

function optionKey(option: HospitalHandbookOption): string {
  return `${option.serviceId}:${option.siteId ?? ""}`;
}

/**
 * The hospitals a reader can change to, as a list of rows with a check on the
 * current one (a ruling: a segmented control cannot hold hospital names at
 * phone width). Names are text only (owner Q6). Renders nothing when there is
 * no choice to make.
 */
export function OnCallHospitalChooser({
  handbook,
  onChosen,
  testId = "on-call-hospital-chooser",
}: {
  readonly handbook: HospitalHandbookState;
  /** Called after a choice, e.g. to close the sheet the list sits in. */
  readonly onChosen?: () => void;
  readonly testId?: string;
}) {
  if (handbook.hospitals.length < 2) return null;
  return (
    <ul role="radiogroup" aria-label="Hospital" className={onCallModuleSurface} data-testid={testId}>
      {handbook.hospitals.map((option) => {
        const key = optionKey(option);
        const selected = key === handbook.hospitalKey;
        const name = option.siteName ?? option.serviceName;
        const detail = option.siteName ? option.serviceName : null;
        return (
          <li key={key} className={cn(onCallInsetHairline, "min-w-0")}>
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                handbook.changeHospital(option.serviceId, option.siteId);
                onChosen?.();
              }}
              className={cn(
                focusRing,
                onCallPressable,
                detail ? onCallRowHeight.double : onCallRowHeight.single,
                "flex w-full min-w-0 items-center gap-3 px-3 text-left",
              )}
            >
              <span className="grid min-w-0 flex-1 gap-0.5 py-1.5">
                <span className={cn(onCallNameText, "break-words text-base-minus text-[color:var(--text-heading)]")}>
                  {name}
                </span>
                {detail ? <span className={cn(onCallSecondaryText, "break-words")}>{detail}</span> : null}
              </span>
              {selected ? (
                <Check
                  aria-hidden="true"
                  strokeWidth={2}
                  className="size-icon-lg shrink-0 text-[color:var(--clinical-accent)]"
                />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
