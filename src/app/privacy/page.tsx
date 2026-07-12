import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ClinicalBadge } from "@/components/clinical-dashboard/clinical-badge";
import {
  cn,
  eyebrowText,
  raisedCard,
  searchPageCanvas,
  searchPageContainer,
  searchPageShell,
} from "@/components/ui-primitives";
import { privacyCopy } from "@/lib/ui-copy";

export const metadata: Metadata = {
  title: "Privacy & data handling — Clinical KB",
  description:
    "How Clinical KB handles your questions and documents: what is collected, where it is stored, what is sent to OpenAI, and how long it is kept.",
};

// Plain-language, code-accurate transparency page (APP-5 collection notice + APP-1
// openness). This summarizes the engineering posture documented in
// docs/privacy-impact-assessment.md. It is not legal advice, and it is not a
// substitute for a formal privacy policy reviewed by a privacy officer — that
// review, plus the OpenAI cross-border agreement, is the outstanding PIA-1 step.
type Section = { heading: string; body: ReactNode };

const SECTIONS: Section[] = [
  {
    heading: "What this tool is",
    body: (
      <>
        Clinical KB is a knowledge base over clinical reference material (guidelines, drug monographs, protocols). It is{" "}
        <strong>not a patient-record system</strong> and does not ask you for patient data. The main privacy
        consideration is therefore <em>incidental</em> patient information that a clinician might type into a free-text
        question.
      </>
    ),
  },
  {
    heading: "What is collected",
    body: (
      <>
        Your free-text questions, the generated answers, your account identity (email / sign-in), and any documents you
        upload. Questions and uploaded documents may contain identifiable information if you put it there — which is why
        the notice above asks you not to.
      </>
    ),
  },
  {
    heading: "How your questions are handled",
    body: (
      <>
        Question text is <strong>not stored in raw form by default</strong>. Before anything is logged it is replaced
        with a keyed one-way hash, so the log tables hold a pseudonym rather than your words. Generated answers are
        stored against your account only, and both are automatically deleted on a schedule (see retention).
      </>
    ),
  },
  {
    heading: "Where your data is stored",
    body: (
      <>
        All stored data — documents, indexed text, answers, logs, and sign-in — lives in a database and file store
        hosted in <strong>Sydney, Australia (AWS ap-southeast-2)</strong>. Uploaded files sit in private buckets and are
        reachable only through short-lived (10-minute) links minted after an ownership check.
      </>
    ),
  },
  {
    heading: "What is sent to OpenAI (United States)",
    body: (
      <>
        To understand a question and generate an answer, the question text and the matching excerpts from your library
        are sent to OpenAI in the <strong>United States</strong>. This is the only point where data leaves Australia.
        OpenAI is asked not to retain these requests in its dashboard, and no patient identifiers are added by the app —
        but any details you type are transmitted, so <strong>do not enter identifiable patient details</strong>.
      </>
    ),
  },
  {
    heading: "How long it is kept",
    body: (
      <>
        Logged (hashed) questions and answers are purged after <strong>30 days</strong>; retrieval telemetry after{" "}
        <strong>90 days</strong>. Uploaded documents and their index remain until you remove them.
      </>
    ),
  },
  {
    heading: "Security",
    body: (
      <>
        Data is scoped to your account, storage is private, and access is checked on every request. These are
        engineering safeguards; they do not replace your own judgement about what is safe to enter.
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className={cn(searchPageCanvas)}>
      <div className={cn(searchPageShell)}>
        <div className={cn(searchPageContainer, "space-y-6")}>
          <header className="space-y-2">
            <p className={eyebrowText}>{privacyCopy.pageEyebrow}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--text-heading)] sm:text-3xl">
              {privacyCopy.pageTitle}
            </h1>
            <p className="max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">
              A plain-language summary of how Clinical KB handles your questions and documents. It reflects how the
              software behaves today; it is not legal advice, and a formal privacy policy is still under review.
            </p>
          </header>

          <section className={cn(raisedCard, "p-4 sm:p-5")}>
            <div className="flex items-start gap-3">
              <div className="shrink-0 pt-0.5">
                <ClinicalBadge tone="warning" label="Important" />
              </div>
              <p className="min-w-0 text-sm leading-6 text-[color:var(--text-heading)]">
                Do not enter identifiable patient details (names, dates of birth, record numbers) into your questions.
                Your question text is sent to OpenAI in the United States to generate an answer.
              </p>
            </div>
          </section>

          {SECTIONS.map((section) => (
            <section key={section.heading} className={cn(raisedCard, "p-4 sm:p-5")}>
              <h2 className="text-base font-semibold text-[color:var(--text-heading)]">{section.heading}</h2>
              <p className="mt-1.5 max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
