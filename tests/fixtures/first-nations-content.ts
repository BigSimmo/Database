import type { z } from "zod";
import { stableHash } from "@/lib/first-nations/approval";
import {
  contentSchema,
  firstNationsPageIds,
  parseFirstNationsContent,
  SITUATION_LABELS,
  situationIds,
  type Approval,
  type ServiceProfile,
  type Source,
  type WaMap,
} from "@/lib/first-nations/content-schema";
import type { ModelInputs } from "@/lib/first-nations/view-model";

export type ContentInput = z.input<typeof contentSchema>;

const credit = { sourceId: "src-test", checkedAt: "2026-09-26" } as const;

export function contentInput(): ContentInput {
  return {
    version: 1,
    pages: firstNationsPageIds.map((pageId) => ({
      id: pageId,
      title: pageId,
      sections: [
        {
          id: `${pageId}-main`,
          tab: "Main",
          modules: [
            {
              id: pageId === "bedside" ? "before-you-go-in" : `${pageId}-module`,
              title: "Module",
              icon: "users",
              layout: "list",
              blocks: [
                { kind: "tip", id: `${pageId}-tip`, do: `Tip on ${pageId}`, why: "Because it helps.", ...credit },
              ],
            },
          ],
        },
      ],
    })),
    situations: situationIds.map((id) => ({
      id,
      label: SITUATION_LABELS[id],
      icon: "users",
      phrases: [1, 2, 3].map((n) => ({ say: `Phrase ${n} for ${id}`, why: "It opens the conversation.", ...credit })),
      firstStepRef: "bedside-tip",
      plan: ["bedside-tip", "talking-tip", "aboriginal-interpreting-wa"],
      ...(id === "wants-to-leave" ? { riskLineRef: "wants-to-leave-risk" } : {}),
    })),
    riskLines: [
      {
        kind: "note",
        id: "wants-to-leave-risk",
        heading: "Immediate risk",
        text: "Immediate risk? Follow your hospital's Mental Health Act and security process first.",
        ...credit,
      },
    ],
    statewideContacts: [
      {
        kind: "contact",
        id: "aboriginal-interpreting-wa",
        name: "Aboriginal Interpreting WA",
        detail: "Book 24 h ahead",
        number: "1800 000 012",
        layer: "statewide",
        ...credit,
      },
    ],
    interpreterContactId: "aboriginal-interpreting-wa",
    regions: [
      {
        id: "goldfields",
        label: "Goldfields",
        serviceContactIds: ["aboriginal-interpreting-wa"],
        languages: ["Wangkatha"],
        ...credit,
      },
    ],
    reportEmail: "first-nations-numbers@example.org",
  };
}

export const testSources: Record<string, Source> = {
  "src-test": {
    id: "src-test",
    title: "Test guide",
    publisher: "WA Health",
    url: "https://example.org/guide",
    aboriginalLed: true,
    checkedAt: "2026-09-26",
  },
};

export const testMap: WaMap = {
  version: 1,
  sourceId: "src-test",
  checkedAt: "2026-09-26",
  viewBox: "0 0 100 100",
  regions: [{ id: "goldfields", path: "M50 50H90V90H50Z" }],
};

export function testInputs(overrides: Partial<ModelInputs> = {}): ModelInputs {
  return {
    content: parseFirstNationsContent(contentInput()),
    approvals: [],
    profile: null,
    sources: testSources,
    map: testMap,
    ...overrides,
  };
}

export function enabledProfile(): ServiceProfile {
  return {
    id: "emhs",
    name: "East Metropolitan Health Service",
    enabled: true,
    hospitals: [
      {
        id: "rph",
        name: "Royal Perth Hospital",
        liaisonContactId: "rph-liaison",
        switchboardContactId: "rph-switchboard",
      },
    ],
    contacts: [
      {
        kind: "contact",
        id: "rph-liaison",
        name: "Aboriginal liaison team",
        number: "9000 0001",
        hours: { days: [1, 2, 3, 4, 5], open: "08:00", close: "16:30" },
        layer: "service",
        ...credit,
      },
      { kind: "contact", id: "rph-switchboard", name: "Switchboard", number: "9000 0000", layer: "service", ...credit },
    ],
    acknowledgement: "Approved acknowledgement words.",
    contentOwnerRole: "Aboriginal Health",
    reportEmail: "aboriginal-health-numbers@example.org",
  };
}

/** An approval record whose hash matches `content` (the owner's recorded OK). */
export function approvalFor(subjectId: string, content: unknown): Approval {
  return {
    subjectId,
    body: "PsychSift",
    role: "Owner",
    date: "2026-09-27",
    reference: "cmsg_owner_ok",
    contentSha256: stableHash(content),
  };
}

/** Content with one of our own note-wording blocks on the Contacts page, which must stay hidden until approved. */
export function contentWithNoteWording(): ContentInput {
  const input = contentInput();
  const contacts = input.pages.find((p) => p.id === "contacts");
  if (!contacts) throw new Error("fixture has no contacts page");
  contacts.sections[0].modules[0].blocks.push({
    kind: "noteWording",
    id: "w1",
    heading: "Note wording",
    template: "Collaborated with [blank].",
    ...credit,
  });
  return input;
}
