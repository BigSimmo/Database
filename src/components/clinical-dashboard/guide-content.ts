export const guideTopicIds = [
  "getting-started",
  "ask-better-questions",
  "document-scope",
  "answer-anatomy",
  "sources-citations",
  "uploads-indexing",
  "privacy-safe-use",
  "keyboard-shortcuts",
] as const;

export type GuideTopicId = (typeof guideTopicIds)[number];
export type GuideView = "home" | "topics" | "topic" | "tour";

export type GuideSection = {
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
};

export type GuideTopic = {
  id: GuideTopicId;
  title: string;
  navLabel: string;
  summary: string;
  sections: readonly GuideSection[];
};

export const guideTopics: readonly GuideTopic[] = [
  {
    id: "getting-started",
    title: "Getting started with Clinical KB",
    navLabel: "Getting started",
    summary: "Understand what Clinical KB does and follow the evidence-first workflow from question to source.",
    sections: [
      {
        heading: "Use it as a source-backed starting point",
        paragraphs: [
          "Clinical KB helps you search indexed clinical documents, review a concise answer, and move quickly to the evidence behind it. It is designed to shorten the path to relevant guidance; it does not replace the original document, local policy, clinical assessment, or professional judgement.",
          "Begin with one focused question. Add document scope only when the task should use particular guidance. Read the answer as a structured orientation, then follow its citations to the retrieved source passages and original document before applying it.",
        ],
      },
      {
        heading: "The evidence-first workflow",
        bullets: [
          "Question — describe one clinical information need without patient-identifiable information.",
          "Scope — search all indexed sources or deliberately restrict the document set.",
          "Answer — read the result, its status, and any safety or evidence warnings.",
          "Citation — identify which source is linked to each important claim.",
          "Source — confirm wording, population, recency, exceptions, and context in the original guidance.",
        ],
      },
    ],
  },
  {
    id: "ask-better-questions",
    title: "Ask better questions",
    navLabel: "Ask better questions",
    summary: "Write one focused, context-rich question that is easy to retrieve and straightforward to verify.",
    sections: [
      {
        heading: "Ask for one decision at a time",
        paragraphs: [
          "A focused question gives search and ranking a clearer target. State the topic, population, and the type of guidance you need. Include setting or jurisdiction only when it changes the answer. Use ordinary clinical language rather than a long narrative or a list of loosely related requests.",
          "Split compound questions into separate searches. This makes missing evidence easier to notice and lets you verify each answer against its own citations. If the first result is broad, refine the question or use document scope instead of adding several new issues at once.",
        ],
      },
      {
        heading: "Keep the query safe and useful",
        bullets: [
          "Do not enter names, identifiers, dates of birth, addresses, or other patient-identifiable information.",
          "Describe a general population or clinical scenario rather than an individual patient.",
          "Ask for the kind of information needed, such as assessment, monitoring, contraindications, or referral criteria.",
          "Avoid assuming the answer in the question; neutral wording makes conflicting evidence easier to see.",
        ],
      },
    ],
  },
  {
    id: "document-scope",
    title: "Choose the right document scope",
    navLabel: "Document scope",
    summary: "Decide when to search the whole library and when a deliberately restricted source set is safer.",
    sections: [
      {
        heading: "Start broad unless the task is source-specific",
        paragraphs: [
          "Search all indexed documents when you are exploring a topic, looking for the most relevant current guidance, or do not yet know which source owns the answer. Broader scope lets the system compare available material and surface the strongest matches.",
          "Restrict scope when the question must be answered from named local policy, a particular guideline set, or documents you are comparing. The scope control changes the sources that can be retrieved; it does not guarantee that the selected documents contain an answer.",
        ],
      },
      {
        heading: "Check scope before trusting the result",
        bullets: [
          "Review the active scope indicator before submitting the question.",
          "If evidence is unexpectedly absent, clear or widen scope before concluding that no guidance exists.",
          "Use document titles and metadata to confirm that the intended version is included.",
          "Treat an empty scoped result as a result for that selected set, not the entire library.",
        ],
      },
    ],
  },
  {
    id: "answer-anatomy",
    title: "Understand and verify an answer",
    navLabel: "Answer anatomy",
    summary: "Connect important claims to citations, source passages, and the original document before acting.",
    sections: [
      {
        heading: "Read the status before the prose",
        paragraphs: [
          "An answer can be source-backed, source-only, incomplete, or accompanied by warnings about evidence quality or verification. Read those signals first. They describe how the response was assembled and what still needs checking; they are not decorative labels.",
          "Citation chips connect answer content to retrieved evidence. Top source identifies the most useful starting document, but it does not mean every sentence is confirmed by that one source. Important claims should be checked against the specific cited passage and then against the surrounding page or section.",
        ],
      },
      {
        heading: "Verify in three steps",
        bullets: [
          "Check the claim — identify the exact statement that could change care or interpretation.",
          "Open the citation — inspect the linked passage and confirm it addresses the same claim.",
          "Read the source — check population, setting, recency, dose, exceptions, and nearby qualifiers.",
          "If a claim has no direct source, treat it as unconfirmed rather than filling the gap from memory.",
        ],
      },
    ],
  },
  {
    id: "sources-citations",
    title: "Work with sources and citations",
    navLabel: "Sources & citations",
    summary:
      "Use source previews, passages, pages, images, and provenance to judge whether evidence supports the answer.",
    sections: [
      {
        heading: "Move from preview to original",
        paragraphs: [
          "The Sources control gathers the evidence attached to an answer. Source previews show the document, page, match information, and an extract when available. Use them to orient yourself, then open the original PDF page when wording, tables, diagrams, footnotes, or section context could affect meaning.",
          "Quotes and images appear only when relevant evidence was retrieved. An empty evidence section means that answer did not include that evidence type; it does not prove the source document contains none.",
        ],
      },
      {
        heading: "Check provenance and document status",
        bullets: [
          "Confirm the title, issuing body, page, section, and version are the ones you intended to use.",
          "Notice current, review-due, outdated, or unverified source-status signals.",
          "Check that the passage supports the claim, not merely the same topic or terminology.",
          "If citations conflict, prefer the applicable primary guidance and resolve the discrepancy outside the generated answer.",
        ],
      },
    ],
  },
  {
    id: "uploads-indexing",
    title: "Uploads and indexing",
    navLabel: "Uploads & indexing",
    summary:
      "Understand who can add documents, what indexing states mean, and where ordinary users find available sources.",
    sections: [
      {
        heading: "Use Sources for ordinary document access",
        paragraphs: [
          "Most users work with documents that are already available through Sources. Upload and indexing tools are restricted to authorised administrators because they change the shared evidence library and require storage, database, extraction, and indexing services.",
          "A successful upload is not immediately searchable. The document must move through processing and indexing before its contents can appear in search. Demo content is synthetic and does not prove that a real upload pipeline or provider-backed workflow is configured.",
        ],
      },
      {
        heading: "Interpret document states",
        bullets: [
          "Indexed — available to the relevant search and scope controls.",
          "Processing — accepted but not yet ready for reliable retrieval.",
          "Failed — requires authorised review or retry; do not assume partial content is searchable.",
          "If an expected source is missing, check its library status and access before changing the clinical question.",
        ],
      },
    ],
  },
  {
    id: "privacy-safe-use",
    title: "Privacy and safe use",
    navLabel: "Privacy & safe use",
    summary:
      "Protect patient information, retain provenance, and keep clinical judgement in every use of generated content.",
    sections: [
      {
        heading: "Keep patient information out of search",
        paragraphs: [
          "Do not enter patient-identifiable information. Frame questions around a general clinical scenario or population. Recent searches may be retained in the browser for convenience, so treat a shared workstation as shared space and clear browser-local history when appropriate.",
          "Generated text is a draft orientation, not a final clinical note or instruction. Before using it, confirm the source is applicable and current, and check population, dose, timing, contraindications, exceptions, and local policy in the original material.",
        ],
      },
      {
        heading: "Copy with context",
        bullets: [
          "Keep attribution, warnings, citations, and the provenance footer with copied material.",
          "Do not remove an uncertainty or source-status warning to make a draft read more confidently.",
          "Re-check source meaning after editing or shortening copied text.",
          "Use professional judgement and the full clinical context before acting or documenting.",
        ],
      },
    ],
  },
  {
    id: "keyboard-shortcuts",
    title: "Keyboard shortcuts",
    navLabel: "Keyboard shortcuts",
    summary: "Use the implemented search-focus shortcut and standard dialog dismissal without losing your place.",
    sections: [
      {
        heading: "Current keyboard controls",
        paragraphs: [
          "Press slash from an app surface to move focus to the main clinical search input. The shortcut is deliberately ignored while you are typing in an input, text area, select control, or editable region, and when Ctrl, Command, or Alt is held. This prevents a slash that belongs in your text from unexpectedly moving focus.",
        ],
        bullets: [
          "/ — focus the main clinical search input when you are not already editing text.",
          "Esc — close the active dialog or other dismissible surface that supports it.",
        ],
      },
      {
        heading: "Keep your place",
        paragraphs: [
          "The Guide Centre traps focus while it is open so Tab and Shift Tab remain inside the dialog. Pressing Escape closes the top-most open Sheet; when the guide was opened from Settings, focus returns to Guide & help. Use the visible focus indicator to confirm where the next keyboard action will land. Actions without an implemented keyboard shortcut remain available through their labelled buttons and menus.",
        ],
      },
    ],
  },
] as const;

export const guideTopicById = Object.fromEntries(guideTopics.map((topic) => [topic.id, topic])) as Record<
  GuideTopicId,
  GuideTopic
>;

export const guideTourStepIds = ["start", "ask", "scope", "verify", "safe-use"] as const;
export type GuideTourStepId = (typeof guideTourStepIds)[number];

export type GuideTourStep = {
  id: GuideTourStepId;
  label: string;
  topicId: GuideTopicId;
  focusHeading: string;
};

export const guideTourSteps: readonly GuideTourStep[] = [
  { id: "start", label: "Start here", topicId: "getting-started", focusHeading: "The evidence-first workflow" },
  {
    id: "ask",
    label: "Ask with precision",
    topicId: "ask-better-questions",
    focusHeading: "Ask for one decision at a time",
  },
  {
    id: "scope",
    label: "Control your scope",
    topicId: "document-scope",
    focusHeading: "Start broad unless the task is source-specific",
  },
  { id: "verify", label: "Verify the evidence", topicId: "answer-anatomy", focusHeading: "Verify in three steps" },
  { id: "safe-use", label: "Use answers safely", topicId: "privacy-safe-use", focusHeading: "Copy with context" },
] as const;

export const guideQuickTasks = [
  { label: "Ask a better question", topicId: "ask-better-questions" },
  { label: "Choose document scope", topicId: "document-scope" },
  { label: "Verify an answer", topicId: "answer-anatomy" },
  { label: "Use content safely", topicId: "privacy-safe-use" },
] as const satisfies ReadonlyArray<{ label: string; topicId: GuideTopicId }>;
