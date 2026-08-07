"use client";

import Link from "next/link";
import { MessageSquareText, ShieldAlert } from "lucide-react";

import { cn } from "@/components/ui-primitives";

import { AppShell, ComposerPill, DeviceFrame, Pair, SectionIntro, focusRing } from "./shared";

const OBLIGATION = "Do not enter patient-identifiable information.";
const PRIVACY_LINK = "Privacy and data processing";
const VERIFY = "Answers are AI-generated — verify against the cited source before clinical use.";

function SafetyCard({ phone }: { phone?: boolean }) {
  return (
    <div
      role="note"
      aria-label="Answer safety notice"
      className={cn(
        "w-full overflow-hidden rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--surface)] text-left",
        phone ? "text-2xs" : "text-xs",
      )}
    >
      <div className="flex items-start gap-2 border-b border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2.5">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" aria-hidden />
        <p className="min-w-0 font-semibold leading-4 text-[color:var(--warning-text)]">{OBLIGATION}</p>
      </div>
      <div className="grid gap-1.5 px-3 py-2.5 text-[color:var(--text-muted)]">
        <p className="leading-4">
          <span className="font-medium text-[color:var(--text-heading)]">AI-generated answers</span>
          {" · "}
          verify against the cited source before clinical use.
        </p>
        <p className="leading-4">
          Searches the Clinical Guide library.{" "}
          <Link
            href="/privacy"
            className={cn(
              "font-medium underline decoration-[color:var(--border-strong)] underline-offset-2",
              focusRing,
            )}
          >
            {PRIVACY_LINK}
          </Link>
        </p>
      </div>
    </div>
  );
}

function AnswerHomeFrame({ device }: { device: "desktop" | "phone" }) {
  const phone = device === "phone";
  return (
    <DeviceFrame device={device} label={phone ? "Phone hero" : "Desktop hero"}>
      <AppShell device={device} active="answer" modeLabel="Answer" ModeIcon={MessageSquareText}>
        <div
          className={cn(
            "mx-auto grid w-full justify-items-center",
            phone ? "max-w-[21rem] gap-3 px-4 py-6" : "max-w-[34rem] gap-4 px-6 py-10",
          )}
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <MessageSquareText className="h-5 w-5" aria-hidden />
          </span>
          <div className="grid justify-items-center gap-1.5 text-center">
            <h3
              className={cn(
                "font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)]",
                phone ? "text-2xl" : "text-3xl",
              )}
            >
              How can I help?
            </h3>
            <p className="text-sm text-[color:var(--text-muted)]">
              Ask a clinical question or search your{" "}
              <span className="font-semibold text-[color:var(--text-heading)]">Clinical Guide library</span>.
            </p>
          </div>
          <ComposerPill value="" phone={phone} placeholder="Ask a clinical question…" />
          <SafetyCard phone={phone} />
          <p className="text-center text-2xs leading-4 text-[color:var(--text-soft)]">
            Same register as DSM / Prescribing / Differentials: obligation first, then verify-before-use.
          </p>
          <p className="sr-only">{VERIFY}</p>
        </div>
      </AppShell>
    </DeviceFrame>
  );
}

export function AnswerHomePerfectedSection() {
  return (
    <section id="answer-home" aria-labelledby="answer-home-title" className="scroll-mt-8">
      <SectionIntro
        issue="#165 · #166"
        title="Answer home safety notice"
        body="Answer generates prose from retrieved sources. The hero must say that up front, in the same clinical-mode voice as DSM and Prescribing — not as a quiet privacy footnote under a capability badge."
        pick="02 Safety card — obligation on a warning-tinted top row; AI-generated verify line + privacy link below in one grey voice."
      />
      <Pair desktop={<AnswerHomeFrame device="desktop" />} phone={<AnswerHomeFrame device="phone" />} />
    </section>
  );
}
