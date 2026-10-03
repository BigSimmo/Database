"use client";

import { CloudOff, LogIn, RotateCcw, TriangleAlert } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { ModeFeaturedModule } from "@/components/mode-kit/featured-module";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { ModeNotice } from "@/components/mode-kit/notice";
import {
  TODAY_NEEDS_YOU_LIMIT,
  todayStateCopy,
  type TodaySharedStateKind,
  type TodaySlot,
} from "@/components/mode-kit/today/today-copy";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { Button } from "@/components/ui/button";
import { sortTodayItems } from "@/lib/today/today-order";
import type { TodayItem } from "@/lib/today/today-item";

/**
 * A mode's shared state, when it is not simply "ready".
 *
 * `loading`, `signed-out` and `failed` replace everything below the safety
 * rail: nothing is shown rather than a partial or guessed day. `offline` and
 * `demo` keep the page and add one notice above Now, because the content is
 * still useful but must be read with that caveat. `empty` keeps Now and says
 * "Nothing needs you" in the Needs-you slot; a mode sets it only when every
 * read succeeded.
 */
export type TodaySharedState =
  | { readonly kind: "loading" }
  | { readonly kind: "signed-out"; readonly onSignIn: () => void }
  | { readonly kind: "failed"; readonly onRetry: () => void }
  | { readonly kind: "offline"; readonly onRetry?: () => void }
  | { readonly kind: "empty" }
  | { readonly kind: "demo" };

export interface TodayNeedsYouSlot {
  /** Any order: the shell sorts with the shared Today order. */
  readonly items: readonly TodayItem[];
  /** The mode's full list, for "See all (n)" past the first three. */
  readonly seeAllHref: string;
  /** Optional row renderer returning one `<li>` (a `ModeRow`); defaults to title, state words, detail and href. */
  readonly renderItem?: (item: TodayItem) => ReactNode;
}

function Slot({ slot, children }: { readonly slot: TodaySlot; readonly children: ReactNode }) {
  return (
    <div data-today-slot={slot} className="grid min-w-0 gap-2">
      {children}
    </div>
  );
}

function severityWords(item: TodayItem): string | null {
  if (item.severity === "overdue") return "Overdue";
  if (item.severity === "soon") return "Due soon";
  return null;
}

function DefaultNeedsYouRow({ item }: { readonly item: TodayItem }) {
  const words = severityWords(item);
  const subtitle = [words, item.detail].filter(Boolean).join(" · ");
  return (
    <ModeRow title={item.title} subtitle={subtitle || undefined} href={item.href} testId={`today-item-${item.id}`} />
  );
}

function NeedsYou({
  slot,
  mode,
  empty,
}: {
  readonly slot: TodayNeedsYouSlot;
  readonly mode: string;
  readonly empty: boolean;
}) {
  const sorted = sortTodayItems(slot.items);
  if (sorted.length === 0) {
    if (!empty) return null;
    const copy = todayStateCopy.empty(mode);
    return (
      <Slot slot="needs-you">
        <ModeNotice testId="today-needs-you-empty">
          {copy.title}. {copy.body}
        </ModeNotice>
      </Slot>
    );
  }
  const shown = sorted.slice(0, TODAY_NEEDS_YOU_LIMIT);
  return (
    <Slot slot="needs-you">
      <ModeGroupedList eyebrow="Needs you" testId="today-needs-you">
        {shown.map((item) =>
          slot.renderItem ? (
            <Fragment key={item.id}>{slot.renderItem(item)}</Fragment>
          ) : (
            <DefaultNeedsYouRow key={item.id} item={item} />
          ),
        )}
        {sorted.length > shown.length ? (
          <ModeRow title={`See all (${sorted.length})`} href={slot.seeAllHref} testId="today-needs-you-see-all" />
        ) : null}
      </ModeGroupedList>
    </Slot>
  );
}

function BlockingState({ state, modeName }: { readonly state: TodaySharedState; readonly modeName: string }) {
  if (state.kind === "loading") {
    return (
      <div data-testid="today-state-loading" className="grid gap-5">
        <span role="status" className="sr-only">
          {todayStateCopy.loading(modeName).title}
        </span>
        <ModeModuleSkeleton rows={2} twoLine />
        <ModeModuleSkeleton rows={3} twoLine eyebrow />
      </div>
    );
  }
  if (state.kind === "signed-out") {
    const copy = todayStateCopy["signed-out"](modeName);
    return (
      <EmptyState
        icon={LogIn}
        title={copy.title}
        body={copy.body}
        testId="today-state-signed-out"
        actions={
          <Button variant="primary" onClick={state.onSignIn}>
            {copy.action}
          </Button>
        }
      />
    );
  }
  if (state.kind === "failed") {
    const copy = todayStateCopy.failed(modeName);
    return (
      <EmptyState
        icon={TriangleAlert}
        title={copy.title}
        body={copy.body}
        live="polite"
        testId="today-state-failed"
        actions={
          <Button variant="secondary" onClick={state.onRetry}>
            <RotateCcw aria-hidden="true" className="size-icon-sm" />
            {copy.action}
          </Button>
        }
      />
    );
  }
  return null;
}

function CaveatNotice({ state, modeName }: { readonly state: TodaySharedState; readonly modeName: string }) {
  if (state.kind === "offline") {
    const copy = todayStateCopy.offline(modeName);
    return (
      <ModeNotice tone="warning" testId="today-state-offline">
        <span className="inline-flex items-center gap-1.5">
          <CloudOff aria-hidden="true" className="size-icon-sm" />
          {copy.title}.
        </span>{" "}
        {copy.body}
        {state.onRetry ? (
          <>
            {" "}
            <button type="button" className="underline" onClick={state.onRetry}>
              {copy.action}
            </button>
          </>
        ) : null}
      </ModeNotice>
    );
  }
  if (state.kind === "demo") {
    const copy = todayStateCopy.demo();
    return (
      <ModeNotice testId="today-state-demo">
        {copy.title}: {copy.body}
      </ModeNotice>
    );
  }
  return null;
}

const blockingKinds = new Set<TodaySharedStateKind>(["loading", "signed-out", "failed"]);

/**
 * The shared Today page: seven fixed slots in one order, the same on every
 * mode, so a doctor moving between modes always finds the same thing in the
 * same place.
 *
 *   1. Status line   — greeting, date, hospital or shift (always)
 *   2. Safety rail   — optional; never hidden by a loading or failed state
 *   3. Now           — always shown; exactly ONE featured module (the shell
 *                      draws the featured surface, so a mode cannot add two)
 *   4. Needs you     — overdue first, three rows, then "See all (n)"
 *   5. Coming up     — Perth time, the mode's own module
 *   6. At a glance   — counts or facts
 *   7. Shortcuts     — links to the mode's other pages
 *
 * The slot order lives in `todaySlotOrder` (today-copy.ts) and is pinned by
 * tests/mode-kit-today-shell.dom.test.tsx. A slot passed `null`/`undefined`
 * renders nothing and reserves nothing.
 */
export function TodayShell({
  mode,
  modeName,
  status,
  safety,
  now,
  needsYou,
  comingUp,
  atAGlance,
  shortcuts,
  state,
  testId,
}: {
  /** Mode identity for the featured tint, e.g. `my-work`. */
  readonly mode: string;
  /** The mode's reader-facing name, e.g. "Admin", used in the shared state copy. */
  readonly modeName: string;
  readonly status: ReactNode;
  readonly safety?: ReactNode;
  /** The body of the one featured module. Required: Now is always shown. */
  readonly now: ReactNode;
  readonly needsYou?: TodayNeedsYouSlot | null;
  readonly comingUp?: ReactNode;
  readonly atAGlance?: ReactNode;
  readonly shortcuts?: ReactNode;
  /** Omit when the page is simply ready. */
  readonly state?: TodaySharedState | null;
  readonly testId?: string;
}) {
  const blocking = state && blockingKinds.has(state.kind);
  return (
    <div className="grid min-w-0 gap-5 sm:gap-6" data-testid={testId}>
      <Slot slot="status">{status}</Slot>
      {safety ? <Slot slot="safety">{safety}</Slot> : null}
      {blocking && state ? (
        <BlockingState state={state} modeName={modeName} />
      ) : (
        <>
          {state ? <CaveatNotice state={state} modeName={modeName} /> : null}
          <Slot slot="now">
            <ModeFeaturedModule mode={mode} testId="today-now">
              {now}
            </ModeFeaturedModule>
          </Slot>
          {needsYou ? <NeedsYou slot={needsYou} mode={modeName} empty={state?.kind === "empty"} /> : null}
          {comingUp ? <Slot slot="coming-up">{comingUp}</Slot> : null}
          {atAGlance ? <Slot slot="at-a-glance">{atAGlance}</Slot> : null}
          {shortcuts ? <Slot slot="shortcuts">{shortcuts}</Slot> : null}
        </>
      )}
    </div>
  );
}
