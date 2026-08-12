import type { ReactNode } from "react";

/**
 * Canonical privacy-page governance copy.
 *
 * Wording is pinned by `tests/privacy-ui.test.ts`. Presentation (Quiet Signal
 * chrome, accordion, processing map) may change; these strings and the
 * `<strong>` spacing on "not a patient-record system" must not drift.
 */

export const PRIVACY_DRAFT_DISCLAIMER =
  "This is draft product information based on the repository's configured behaviour. It is not legal advice, a final privacy policy, or an assertion of governance approval.";

export const PRIVACY_IMPORTANT_SHORT =
  "Do not enter identifiable patient details. Processing may include Singapore and the OpenAI API.";

export const PRIVACY_IMPORTANT_FULL =
  "Do not enter identifiable patient details such as names, dates of birth, or record numbers. Requests are processed by the application service in Singapore. With external provider mode configured, question text may be sent to the OpenAI API for retrieval embedding even when the final response is source-only; model-backed answer synthesis also sends the question and selected evidence.";

export type PrivacySection = {
  heading: string;
  short: string;
  gist: string;
  body: ReactNode;
};

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    heading: "What this tool is",
    short: "Tool",
    gist: "Clinical reference KB — not a patient-record system",
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
    short: "Collected",
    gist: "Questions, docs, telemetry — safety-plan work stays in-tab",
    body: "Questions, generated answers, account identifiers, uploaded documents, retrieved excerpts, document metadata, and operational or retrieval telemetry may be processed. Free text and uploaded material can contain sensitive information if you enter it. Safety-plan working content is different: it remains in the current browser tab and is not sent to the application service or stored by Clinical KB.",
  },
  {
    heading: "How questions are handled",
    short: "Questions",
    gist: "Hashed logs · answers omitted · tab threads up to 12 hours",
    body: (
      <>
        Raw question text is not written to query logs by default; logs use a keyed one-way hash. Generated answer text
        is also omitted from durable query logs by default. A short-lived response cache can contain the answer while
        its read TTL is valid. To make recent answers reappear quickly, completed answer threads may also remain in this
        browser tab for up to 12 hours. That tab-only copy stays in this tab, is not shared across tabs or devices, and
        is never sent to the application service.
      </>
    ),
  },
  {
    heading: "Where data is stored and processed",
    short: "Regions",
    gist: "Sydney storage · Singapore app + worker",
    body: "Documents, extracted evidence, metadata, account records, and owner-scoped operational records are stored in the configured Supabase project in Sydney. The production application and ingestion worker currently run on Railway in Singapore, so questions, retrieved evidence, answers, and ingestion material are processed in or transit through Singapore. File buckets are private and links are time-limited. The operator must verify deployed regions and contractual controls.",
  },
  {
    heading: "External provider processing",
    short: "Providers",
    gist: "OpenAI embedding / synthesis may leave Australia",
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
    short: "Retention",
    gist: "30-day queries · 90-day logs · hourly cache purge",
    body: "Repository migrations configure 30-day retention for RAG query records, 90-day retention for retrieval logs and query-miss telemetry, and a bounded hourly purge of expired response-cache rows when the database scheduler is available. The operator must verify that those scheduled jobs are active. Uploaded documents remain until removed under the applicable process. Completed answer threads in the current browser tab expire no later than 12 hours after the most recent answer and are also cleared by New chat, sign-out, or an account change. Safety-plan working content has no Clinical KB retention: it is discarded when the component is cleared or the tab is closed. Clipboard, print, and PDF copies are outside the app and must follow the organisation's approved record-handling process.",
  },
  {
    heading: "Your responsibilities",
    short: "You",
    gist: "No identifiers · verify sources · report issues",
    body: "Do not enter patient-identifiable information. In the Safety Plan Generator, add any patient identifier only after export through your organisation's approved clinical-record process. Upload only material you are authorised to use, keep access credentials private, review original linked sources before relying on clinical output, and report suspected privacy or access issues through your organisation's approved process.",
  },
];

export const PRIVACY_PROCESSING_MAP = [
  { place: "Sydney", role: "Supabase storage", tone: "accent" as const },
  { place: "Singapore", role: "App + worker", tone: "neutral" as const },
  { place: "External", role: "OpenAI API", tone: "warn" as const },
];
