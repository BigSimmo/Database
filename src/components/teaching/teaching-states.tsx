"use client";

import { useState } from "react";

import { modeModuleSurface } from "@/components/mode-kit/recipes";
import { ActionStrip, type TeachingAction } from "@/components/teaching/teaching-actions";
import { Sheet } from "@/components/ui/sheet";
import { cn, textMuted } from "@/components/ui-primitives";

/*
 * The page states in Teaching's words (v5.2 screens 12 to 16). Each is one
 * module: a title, one line and a full-width button. No demo tag, no codes.
 */
export type TeachingNoticeState = "empty" | "no-team" | "signed-out" | "offline" | "error" | "setup";

const COPY: Record<TeachingNoticeState, { title: string; body: (serviceName?: string) => string }> = {
  empty: { title: "No sessions yet", body: (serviceName) => `Nothing published by ${serviceName ?? "your service"}.` },
  "no-team": {
    title: "You're not in a teaching service yet",
    body: () => "Ask your service's organiser to invite you.",
  },
  "signed-out": { title: "Sign in to see your teaching", body: () => "Sessions, check-ins and your logbook." },
  offline: { title: "You're offline", body: () => "Missed check-ins can be added for 7 days." },
  error: { title: "Teaching couldn't load", body: () => "Nothing changed. Your records are safe." },
  setup: { title: "Teaching is being set up", body: () => "It will appear here when it's ready." },
};

export function TeachingStateNotice({
  state,
  serviceName,
  onRetry,
  onSignIn,
  onOpenDemo,
  onSwitchService,
}: {
  state: TeachingNoticeState;
  serviceName?: string;
  onRetry?: () => void;
  onSignIn?: () => void;
  onOpenDemo?: () => void;
  onSwitchService?: () => void;
}) {
  const [howOpen, setHowOpen] = useState(false);
  const actions: TeachingAction[] = [];
  if (state === "signed-out") {
    if (onSignIn) actions.push({ id: "sign-in", label: "Sign in", onClick: onSignIn, emphasis: "primary" });
    if (onOpenDemo) actions.push({ id: "demo", label: "Open the demo", onClick: onOpenDemo, emphasis: "text" });
  }
  if ((state === "error" || state === "offline") && onRetry)
    actions.push({ id: "retry", label: "Try again", onClick: onRetry, emphasis: "secondary" });
  if (state === "empty" && onSwitchService)
    actions.push({ id: "switch", label: "Switch service", onClick: onSwitchService, emphasis: "secondary" });
  if (state === "no-team")
    actions.push({ id: "how", label: "How to join a service", onClick: () => setHowOpen(true), emphasis: "secondary" });

  return (
    <section
      data-testid={`teaching-state-${state}`}
      role={state === "offline" ? "status" : undefined}
      className={cn(modeModuleSurface, "grid gap-1 p-3")}
    >
      <p className="text-base-minus font-medium text-[color:var(--text-heading)]">{COPY[state].title}</p>
      <p className={cn("text-sm", textMuted)}>{COPY[state].body(serviceName)}</p>
      <ActionStrip layout="stack" actions={actions} className="pt-1" />
      {state === "no-team" ? (
        <Sheet open={howOpen} onClose={() => setHowOpen(false)} title="How to join a service">
          <div className="grid gap-2 text-sm text-[color:var(--text-heading)]">
            <p>Your service&apos;s organiser gives you an invitation code for your work email.</p>
            <p>Sign in with that email, then enter the code under Join with invitation.</p>
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}
