import type { Metadata } from "next";
import Link from "next/link";

import { cn, panelSubtle, textMuted } from "@/components/ui-primitives";

export const metadata: Metadata = {
  title: "Privacy and data processing | Clinical KB",
  description: "Draft product information about Clinical KB data processing.",
};

const sections = [
  {
    title: "Data categories",
    body: "The product handles clinical questions, retrieved source excerpts, uploaded documents and their extracted content, document metadata, account identifiers, and operational or retrieval telemetry. Query logging uses hashed or redacted values by default, but free text and uploaded material can still contain sensitive information if a user enters it.",
  },
  {
    title: "External provider processing",
    body: "The configured architecture uses Supabase for authentication, database, and private file storage. When model-backed answering is enabled, the question and selected source excerpts are sent to the configured OpenAI API for answer generation. Provider mode can also fall back to a local source-only response.",
  },
  {
    title: "Storage",
    body: "Documents, extracted evidence, metadata, and owner-scoped operational records are stored in the configured Supabase project. Document and image buckets are private, and the product issues time-limited signed links after an ownership check. Actual deployment region and contractual controls must be confirmed by the operator.",
  },
  {
    title: "Retention",
    body: "Repository migrations configure 30-day retention for RAG query records and 90-day retention for retrieval logs and query-miss records when the database scheduler is available. The generated answer prose is not persisted by default; answer-text storage requires an explicit setting that production-readiness checks reject for production-like use. Audit and document records follow separate operational and governance requirements.",
  },
  {
    title: "Possible overseas processing",
    body: "Model-backed requests use the configured OpenAI API endpoint and may be processed outside Australia. Supabase processing location depends on the configured project region. The operator must verify provider regions, contracts, retention terms, and any cross-border disclosure obligations before clinical use.",
  },
  {
    title: "Your responsibilities",
    body: "Do not enter patient-identifiable information. Upload only material you are authorised to use, keep access credentials private, and review the original linked sources before relying on clinical output. Report suspected privacy or access issues through your organisation's approved process.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="space-y-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          Back to Clinical KB
        </Link>
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--warning)]">
          Draft for privacy and clinical-governance approval
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
          Privacy and data processing
        </h1>
        <p className={cn("max-w-3xl text-base leading-7", textMuted)}>
          This is product information based on the repository&apos;s configured behaviour. It is not legal advice, a
          final privacy policy, or an assertion of governance approval.
        </p>
      </header>

      <div className="mt-8 grid gap-4 sm:mt-10">
        {sections.map((section) => (
          <section
            key={section.title}
            className={cn(panelSubtle, "p-4 sm:p-5")}
            aria-labelledby={`privacy-${section.title.toLowerCase().replaceAll(" ", "-")}`}
          >
            <h2
              id={`privacy-${section.title.toLowerCase().replaceAll(" ", "-")}`}
              className="text-lg font-semibold text-[color:var(--text-heading)]"
            >
              {section.title}
            </h2>
            <p className={cn("mt-2 text-sm leading-6 sm:text-base sm:leading-7", textMuted)}>{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
