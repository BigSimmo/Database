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
  description: "Draft product information about how Clinical KB handles questions and documents.",
};

type Section = { heading: string; body: ReactNode };

const SECTIONS: Section[] = [
  {
    heading: "What this tool is",
    body: (
      <>
        Clinical KB is a knowledge base over clinical reference material. It is{" "}
        <strong>not a patient-record system</strong>
        and does not ask for patient data. The main privacy risk is incidental patient information entered into a
        free-text question or uploaded document.
      </>
    ),
  },
  {
    heading: "What is collected",
    body: "Questions, generated answers, account identifiers, uploaded documents, retrieved excerpts, document metadata, and operational or retrieval telemetry may be processed. Free text and uploaded material can contain sensitive information if you enter it.",
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
    heading: "Where data is stored",
    body: "Documents, extracted evidence, metadata, account records, and owner-scoped operational records are stored in the configured Supabase project. File buckets are private and links are time-limited. The operator must verify the deployed project region and contractual controls.",
  },
  {
    heading: "External provider processing",
    body: (
      <>
        When model-backed answering is enabled, the question and selected source excerpts are sent to the configured
        OpenAI API. This processing may occur outside Australia. Provider mode can also return a local source-only
        response. The operator must verify provider regions, retention terms, contracts, and cross-border obligations.
      </>
    ),
  },
  {
    heading: "Retention",
    body: "Repository migrations configure 30-day retention for RAG query records and 90-day retention for retrieval logs when the database scheduler is available. Query-miss and expired response-cache cleanup require separate governance and operational controls. Uploaded documents remain until removed under the applicable process.",
  },
  {
    heading: "Your responsibilities",
    body: "Do not enter patient-identifiable information. Upload only material you are authorised to use, keep access credentials private, review original linked sources before relying on clinical output, and report suspected privacy or access issues through your organisation's approved process.",
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
              This is draft product information based on the repository&apos;s configured behaviour. It is not legal
              advice, a final privacy policy, or an assertion of governance approval.
            </p>
          </header>

          <section className={cn(raisedCard, "p-4 sm:p-5")}>
            <div className="flex items-start gap-3">
              <div className="shrink-0 pt-0.5">
                <ClinicalBadge tone="warning" label="Important" />
              </div>
              <p className="min-w-0 text-sm leading-6 text-[color:var(--text-heading)]">
                Do not enter identifiable patient details such as names, dates of birth, or record numbers. When
                model-backed answering is enabled, your question is sent to the configured OpenAI API.
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
