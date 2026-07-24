import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { ClinicalBadge } from "@/components/clinical-dashboard/clinical-badge";
import { NavigationBackButton } from "@/components/navigation-back-button";
import { PrivacyPageBackButton } from "@/components/privacy-page-back-button";
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
  description: "Draft product information about how Clinical KB handles questions and documents.",
};

type Section = { heading: string; body: ReactNode };

const SECTIONS: Section[] = [
  {
    heading: "What this tool is",
    body: (
      <>
        Clinical KB is a knowledge base over clinical reference material. It is{" "}
        <strong>not a patient-record system</strong> and its provider-backed features do not ask for patient
        identifiers. The Safety Plan Generator accepts sensitive working content and support contacts but deliberately
        omits a patient-identifier field.
      </>
    ),
  },
  {
    heading: "What is collected",
    body: "Questions, generated answers, account identifiers, uploaded documents, retrieved excerpts, document metadata, and operational or retrieval telemetry may be processed. Free text and uploaded material can contain sensitive information if you enter it. Safety-plan working content is different: it remains in the current browser tab and is not sent to the application service or stored by Clinical KB.",
  },
  {
    heading: "How questions are handled",
    body: (
      <>
        Raw question text is not written to query logs by default; logs use a keyed one-way hash. Generated answer text
        is also omitted from durable query logs by default. A short-lived response cache can contain the answer while
        its read TTL is valid.
      </>
    ),
  },
  {
    heading: "Where data is stored and processed",
    body: "Documents, extracted evidence, metadata, account records, and owner-scoped operational records are stored in the configured Supabase project in Sydney. The production application and ingestion worker currently run on Railway in Singapore, so questions, retrieved evidence, answers, and ingestion material are processed in or transit through Singapore. File buckets are private and links are time-limited. The operator must verify deployed regions and contractual controls.",
  },
  {
    heading: "External provider processing",
    body: (
      <>
        When external provider mode is configured, question text may be sent to the OpenAI API to create a retrieval
        embedding, including when the final response is source-only. When model-backed answer synthesis is used, the
        question and selected source excerpts are also sent. This processing may occur outside Australia. The operator
        must verify provider regions, retention terms, contracts, and cross-border obligations.
      </>
    ),
  },
  {
    heading: "Retention",
    body: "Repository migrations configure 30-day retention for RAG query records, 90-day retention for retrieval logs and query-miss telemetry, and a bounded hourly purge of expired response-cache rows when the database scheduler is available. The operator must verify that those scheduled jobs are active. Uploaded documents remain until removed under the applicable process. Safety-plan working content has no Clinical KB retention: it is discarded when the component is cleared or the tab is closed. Clipboard, print, and PDF copies are outside the app and must follow the organisation's approved record-handling process.",
  },
  {
    heading: "Your responsibilities",
    body: "Do not enter patient-identifiable information. In the Safety Plan Generator, add any patient identifier only after export through your organisation's approved clinical-record process. Upload only material you are authorised to use, keep access credentials private, review original linked sources before relying on clinical output, and report suspected privacy or access issues through your organisation's approved process.",
  },
];

export default function PrivacyPage() {
  return (
    <main className={cn(searchPageCanvas)}>
      <div className={cn(searchPageShell)}>
        <div className={cn(searchPageContainer, "space-y-6")}>
          <header className="space-y-3">
            <Suspense fallback={<NavigationBackButton fallbackHref="/" />}>
              <PrivacyPageBackButton />
            </Suspense>
            <div className="space-y-2">
              <p className={eyebrowText}>{privacyCopy.pageEyebrow}</p>
              <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--text-heading)] sm:text-3xl">
                {privacyCopy.pageTitle}
              </h1>
              <p className="max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">
                This is draft product information based on the repository&apos;s configured behaviour. It is not legal
                advice, a final privacy policy, or an assertion of governance approval.
              </p>
            </div>
          </header>

          <section className={cn(raisedCard, "p-4 sm:p-5")}>
            <div className="flex items-start gap-3">
              <div className="shrink-0 pt-0.5">
                <ClinicalBadge tone="warning" label="Important" />
              </div>
              <p className="min-w-0 text-sm leading-6 text-[color:var(--text-heading)]">
                Do not enter identifiable patient details such as names, dates of birth, or record numbers. Requests are
                processed by the application service in Singapore. With external provider mode configured, question text
                may be sent to the OpenAI API for retrieval embedding even when the final response is source-only;
                model-backed answer synthesis also sends the question and selected evidence.
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
