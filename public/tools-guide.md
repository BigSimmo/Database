# PsychSift tools guide

PsychSift is a private, local-first clinical knowledge base for searching indexed source documents, reviewing evidence, and drafting source-backed clinical answers. It is a clinical reference prototype, not validated clinical decision support.

## Using this guide

This guide describes PsychSift's tool surface: what each tool does, where it opens, and how its data is (or is not) persisted. It is not a statement of clinical safety or governance approval, and no tool here replaces clinical judgement or removes the need to open the cited source before acting. Do not enter identifiable patient details.

Modes shown as `/?mode=<id>` are the shared home with that mode selected; several also have friendly bare paths (for example `/dictionary`, `/services`, `/forms`) that redirect to the same home.

## Tools by capability

### Search references

Tools that find and browse source material or curated registry records. They return matches with links back to their sources; they do not generate answers.

- **Documents** — `/documents`. Search indexed PDFs, guidelines, policies, pages, tables and images, and find the source document, page, table, image or policy wording behind an answer. Returns matching documents with page context, snippets and source links. Does not synthesise an answer: it only returns the source material.
- **Clinical Dictionary** — `/?mode=dictionary`. Open concise, source-governed definitions for psychiatric terms, abbreviations, topics and distinctions, and review each entry's direct source. Does not search the whole corpus or generate answers — it resolves terminology only.
- **Sources** — `/?mode=sources`. Browse the ranked clinical source catalogue: identity, quality bands, locations, publishers, topics and application usage. Read-only records with quality and traceability detail. Does not edit or publish sources.
- **Guidelines** — `/?mode=documents&q=guideline&focus=1`. A prefilled Documents search for "guideline": move from a clinical question to guideline wording, pathway steps and source context. Does not open a separate guideline library — it routes into Documents search with a prefilled term.
- **Services** — `/?mode=services`. Open source-backed service records with referral routes, eligibility, source status and access pathways. Does not make or transmit a referral — it surfaces records and pathways.
- **Forms** — `/?mode=forms`. Find clinical forms and source-backed readiness pathways: form search, readiness checks, pathway tasks and source-backed records. Does not fill, sign or submit forms — it finds the form and its readiness information.

### Generate guidance

Tools that ask a clinical question or compare possibilities and return source-backed guidance. Most open Answer mode; several are prefilled-prompt shortcuts rather than dedicated tools.

- **PsychSift Search** — `/?mode=answer`. Ask source-backed clinical questions and move straight to evidence; returns a concise answer, key points, citations and source links. Does not certify that input is de-identified, and does not replace opening the cited source.
- **Differentials** — `/?mode=differentials`. Build and compare diagnostic possibilities with source-aware prompts; returns ranked differentials, rationale, must-not-miss risks and next-step questions. Does not make a diagnosis or persist a differential as a patient record — results are produced for the current query.
- **Risk & Safety** — `/?mode=answer&q=safety%20check&focus=1`. A prefilled Answer prompt for checking risks, contraindications, alerts and safety guidance; returns prioritised risks, alerts and recommendations with source links. Does not keep a persistent risk register — it is an Answer-mode prompt shortcut.
- **Medication Prescribing** — `/medications`. Review medication context, dosing, interactions, monitoring and medication-specific cautions; returns prescribing guidance, a monitoring plan, cautions and references. Does not prescribe, dispense or keep a patient medication record — it is a source-backed reference workspace.
- **Care plans** — `/?mode=answer&q=care%20plan&focus=1`. A prefilled Answer prompt for structuring care planning, review milestones, monitoring needs and follow-up tasks. Does not create or save a care-plan record — it is an Answer-mode prompt shortcut that returns guidance text.
- **Monitoring** — `/?mode=answer&q=monitoring%20schedule&focus=1`. A prefilled Answer prompt for reviewing monitoring intervals, parameters, alerts and follow-up actions. Does not track or store results — it is an Answer-mode prompt shortcut, not a monitoring record.

### Calculate scores

- **Calculators** — `/?mode=calculators`. Search and complete clinical calculators (PHQ-9, GAD-7, C-SSRS and related scales); returns a total score, severity band, caution flags and source-cited scoring guidance. Does not replace a full assessment or persist results: scores support clinical judgement only, and answers remain in the current browser session.

### Build and export (identifier-free)

- **Safety plan** — `/safety-plan`. Build an identifier-free safety plan with the patient using the Stanley-Brown six steps — warning signs, coping strategies, supports and means safety — with a printable copy. Does not store the plan: working content stays in the current browser tab until you copy, print or save a PDF.

### Retain data

- **Saved workflows** — `/favourites`. Resume saved answers, pinned sources and repeated clinical workflows; requires a signed-in account. Does not store patient data — saved items describe how you use the app, not who your patients are.

## Data persistence

PsychSift is a clinical reference knowledge base, not a patient-record system. Where a tool keeps its data depends on the tool:

- **Account-scoped and persistent — Saved workflows.** Saved favourites and account-linked preferences are stored against your signed-in account and follow you between devices. They are hidden from guests and describe how you use the app, not who your patients are.
- **Current browser session — Calculators.** Calculator answers remain in the current browser session (in memory) and are not intentionally submitted by the calculator interface. They are not saved to your account and are lost on refresh or when the tab closes.
- **Current tab — Answer threads.** Completed answer threads may remain in the current browser tab for up to 12 hours so a recent answer reappears quickly. That copy stays in the tab, is not shared across tabs or devices, and is never sent back to the application service.
- **Current tab only — Safety plan.** Safety-plan working content exists only in the page's memory while the generator is open. It is not saved by the app and is discarded when you clear it or close the tab. Clipboard, print and PDF copies are outside the app and must follow your organisation's approved record-handling process.
- **No record created — Monitoring and Care plans.** Monitoring and Care plans are Answer-mode prompt shortcuts: they produce guidance text, not a persistent monitoring or care-plan record.

By default, question text is logged only as a keyed one-way hash and generated answer text is omitted from durable query logs. Verify the linked source before acting on any clinical output, and report suspected privacy or access problems through your organisation's approved process.
