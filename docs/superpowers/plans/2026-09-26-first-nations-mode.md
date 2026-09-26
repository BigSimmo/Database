# First Nations Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone `first-nations` mode: nine static care pages for hospital doctors caring for Aboriginal and Torres Strait Islander patients, built from checked, credited content files, with per-section approval pinned to a content hash and no database change.

**Architecture:** Content lives in `src/data/first-nations/*.json`, validated by one Zod schema in `src/lib/first-nations/`. One server renderer draws every page from that content. Four small client islands (hours-aware call card, situation sheet, contact actions, primer) carry all interactivity. Mode registration copies the My Work pattern (commit `c01570c4c`).

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs/` before writing route code), React 19, TypeScript 6 strict, Zod 4, Tailwind 4 tokens, Vitest (node + jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-26-first-nations-mode-design.md`. Shared visual rules: `/mnt/project-files/design/mode-design-standard.md` (version 1). Plan page with mockups: the private plan artifact, version 7.

## Global Constraints

- Patient-describing state stays on the screen only. The "Where is home?" region choice and every tick in "Before you go in", the situation sheets and the going-home check are held in component state alone: never saved (no local or session storage, no database), never put in the URL, never sent to the server or to analytics, and never entered into the main search bar, which sends text to OpenAI (design standard §13). They clear when the page is left.
- Every entry in the new regional services list (community-controlled health services, regional mental health teams, travel support) carries a source link and a checked date, like all other content.

- Mode id `first-nations`; label "First Nations"; home `/first-nations`.
- No disease or condition content, no doses, no calculators.
- No database change, no migration, no provider calls, no files under `src/lib/rag/**` or any retrieval/ranking surface.
- No patient data anywhere; no analytics about Indigenous status; team and switchboard numbers only; no personal names; no mobile numbers.
- PsychSift never records Indigenous content as signed off. Approval is only the separate `approvals` record, pinned to `contentSha256`.
- Content files must not contain the keys or words `reviewed`, `signedOff`, `signed_off`, `"approved": true`, `verified`.
- EMHS service layer ships with `"enabled": false`.
- Crisis block is rendered on the server with the page and never lazy-loaded.
- Type weights (shared design standard v2 and Josh's app-wide answers, 2026-09-26): nothing heavier than `font-semibold`; eyebrows `font-semibold` uppercase at the eyebrow tracking (0.06em); numbers at `font-normal` with the `nums` utility; names and the active tab `font-medium`; headings `font-semibold`. Quiet red only for the emergency number (000). Call and primary buttons use the neutral command fill. Phone numbers: short form inside a hospital's own list (`9000 0012`), `(08)` for outside lines, `13 92 76` style for 13 numbers. 24-hour times. Gentle motion that respects reduced-motion. Dark mode follows the phone. Do not touch the shared mode pill or its weight (On Call's PR changes it).
- Times in 24-hour format (`16:30`); phone numbers grouped as in the design standard (`9000 0012` within a hospital list, `(08) 9000 0012` outside, `13 92 76`).
- Tap targets `min-h-12` (48 px); design tokens only (no hex in components); Lucide icons with `aria-hidden`.
- Copy: sentence case, calm, no "verified/valid/safe/compliant/up to date"; say what happened and when ("Checked 26 Sep 2026").
- Never `git add -A`. Run `npm run format` and commit the result before push.

## Review Focus

1. **Clock edges:** at exactly the closing minute, at midnight, and on a WA public holiday the call card must show closed and the switchboard, never "open". (Task 4 tests.)
2. **Overdue recheck:** a contact checked 91 days ago must render the overdue state and move the switchboard to the top, even inside opening hours. (Task 4 tests.)
3. **Web Share missing:** on a browser without `navigator.share`, "Send to a colleague" must fall back to copying the text and say "Copied". (Task 7 test.)
4. **Formatting-only edits:** re-indenting or reordering keys in `pages.json` must not revoke an approval; changing one word of a tip must. (Task 1 tests.)
5. **Service layer off:** with `enabled: false`, no EMHS name or number may appear on any page, the pocket card, or the situation sheet. (Task 3 and Task 8 tests.)

---

## File Structure

| Path                                                        | Responsibility                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/lib/first-nations/content-schema.ts`                   | Zod schema and types for pages, blocks, sources, approvals, service profile              |
| `src/lib/first-nations/approval.ts`                         | Stable hashing and `sectionApprovalState()`                                              |
| `src/lib/first-nations/content.ts`                          | Loads and validates the JSON once; merges the service layer when enabled; lookup helpers |
| `src/lib/first-nations/hours.ts`                            | Pure opening-hours and overdue logic in Perth time                                       |
| `src/lib/first-nations/contact-format.ts`                   | Phone grouping, `tel:` href, vCard text                                                  |
| `src/data/first-nations/sources.json`                       | Source register (title, publisher, url, aboriginalLed, checkedAt)                        |
| `src/data/first-nations/pages.json`                         | Statewide pages, sections, blocks, situations                                            |
| `src/data/first-nations/approvals.json`                     | Approval records (empty at first)                                                        |
| `src/data/first-nations/profiles/emhs.json`                 | EMHS service layer, `enabled: false`                                                     |
| `src/app/(search-app)/first-nations/**/page.tsx`            | Nine thin routes; home also has `loading.tsx`                                            |
| `src/components/first-nations/first-nations-nav-header.tsx` | The one nav-header claimant for the mode                                                 |
| `src/components/first-nations/page-renderer.tsx`            | Server renderer: sections → blocks                                                       |
| `src/components/first-nations/blocks.tsx`                   | Server block components (tip, avoid, contact, quote, steps, links, note)                 |
| `src/components/first-nations/crisis-block.tsx`             | Server crisis numbers from `WA_CRISIS_CONTACTS`                                          |
| `src/components/first-nations/status-call-card.tsx`         | Client: hours-aware call card                                                            |
| `src/components/first-nations/contact-actions.tsx`          | Client: call, copy, share, save, report                                                  |
| `src/components/first-nations/situation-sheet.tsx`          | Client: situations bottom sheet with ticks                                               |
| `src/components/first-nations/primer.tsx`                   | Client: once-only primer                                                                 |
| `src/components/first-nations/pocket-card.tsx`              | Print view of public numbers                                                             |
| `tests/first-nations-*.test.ts(x)`                          | Unit, contract and DOM tests                                                             |

---

### Task 0: Source register (runs in parallel with Tasks 1–5)

**Files:**

- Create: `src/data/first-nations/sources.json`

**Interfaces:**

- Produces: source ids referenced by `pages.json` (`sourceId`), shape `{ id, title, publisher, url, aboriginalLed, checkedAt }`.

- [ ] **Step 1: Run the `sources` skill** for each item the pages need: Aboriginal Interpreting WA, 13YARN (already in `src/lib/crisis-contacts.ts`), MHA 2014 s 81 (already quoted in `data/forms-cultural-notes.json`, forms 3A–3C, `sourceId: "mha-2014-communication-and-cultural-provisions"`), Lin, Green and Bessarab 2016 clinical yarning paper, the national definition of cultural safety (AHPRA / Health Practitioner Regulation National Law), the Social and Emotional Wellbeing framework (Gee, Dudgeon et al.), Close the Gap PBS co-payment (Services Australia), WA Patient Assisted Travel Scheme (WA Health), Coroner's Court of WA information for families, and the published Aboriginal-led or WA Health cultural-care guides the tips will cite. Check every URL against the official page. Record rejected sources in the skill's register.

- [ ] **Step 2: Write `sources.json`** with only checked entries, for example:

```json
{
  "version": 1,
  "sources": [
    {
      "id": "mha-2014-s81",
      "title": "Mental Health Act 2014 (WA), section 81",
      "publisher": "Parliamentary Counsel's Office, WA",
      "url": "https://www.legislation.wa.gov.au/",
      "aboriginalLed": false,
      "checkedAt": "2026-09-26"
    }
  ]
}
```

(The URL shown is the site root only; Step 1 replaces it with the exact checked page.)

- [ ] **Step 3: Commit**

```bash
git add src/data/first-nations/sources.json
git commit -m "First Nations: add checked source register"
```

---

### Task 1: Content schema and approval hashing

**Files:**

- Create: `src/lib/first-nations/content-schema.ts`, `src/lib/first-nations/approval.ts`
- Test: `tests/first-nations-approval.test.ts`

**Interfaces:**

- Produces:
  - `type Block` (union by `kind`: `"tip" | "avoid" | "contact" | "quote" | "steps" | "links" | "note" | "noteWording" | "statusCall"`), each with `id: string`, `sourceId: string`, `checkedAt: string`.
  - `type Section = { id: string; tab: string; blocks: Block[] }`, `type Page = { id: FirstNationsPageId; title: string; sections: Section[] }`.
  - `type Approval = { sectionId: string; body: string; role: string; date: string; reference: string; contentSha256: string }`.
  - `parseFirstNationsContent(input: unknown): FirstNationsContent` (throws with joined issues).
  - `stableHash(value: unknown): string` and `sectionApprovalState(section: Section, approvals: readonly Approval[]): "approved" | "awaiting"`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { sectionApprovalState, stableHash } from "@/lib/first-nations/approval";
import type { Approval, Section } from "@/lib/first-nations/content-schema";

const section: Section = {
  id: "ward-respect",
  tab: "Respect",
  blocks: [
    {
      kind: "tip",
      id: "t1",
      do: "Offer the Aboriginal liaison officer on admission",
      why: "Early support helps people stay for care.",
      sourceId: "s1",
      checkedAt: "2026-09-26",
    },
  ],
};

function approvalFor(s: Section): Approval {
  return {
    sectionId: s.id,
    body: "EMHS Aboriginal Health",
    role: "Manager, Aboriginal Health",
    date: "2026-10-01",
    reference: "EMHS-AH-001",
    contentSha256: stableHash(s),
  };
}

describe("section approval", () => {
  it("is awaiting with no approval record", () => {
    expect(sectionApprovalState(section, [])).toBe("awaiting");
  });
  it("is approved when the hash matches", () => {
    expect(sectionApprovalState(section, [approvalFor(section)])).toBe("approved");
  });
  it("survives key reordering (formatting-only edit)", () => {
    const reordered = JSON.parse(
      JSON.stringify({ blocks: section.blocks, tab: section.tab, id: section.id }),
    ) as Section;
    expect(sectionApprovalState(reordered, [approvalFor(section)])).toBe("approved");
  });
  it("is revoked when one word changes", () => {
    const edited: Section = {
      ...section,
      blocks: [
        { ...section.blocks[0], why: "Early support helps people remain for care." } as Section["blocks"][number],
      ],
    };
    expect(sectionApprovalState(edited, [approvalFor(section)])).toBe("awaiting");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run test:focused -- --files tests/first-nations-approval.test.ts`
Expected: FAIL, cannot resolve `@/lib/first-nations/approval`.

- [ ] **Step 3: Write `content-schema.ts`**

```ts
import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");
const base = { id: z.string().min(1), sourceId: z.string().min(1), checkedAt: day };

export const firstNationsPageIds = [
  "bedside",
  "contacts",
  "talking",
  "family",
  "mental-health",
  "on-the-ward",
  "mistakes",
  "going-home",
  "end-of-life",
] as const;
export type FirstNationsPageId = (typeof firstNationsPageIds)[number];

const tip = z.object({ ...base, kind: z.literal("tip"), do: z.string().min(1), why: z.string().min(1) }).strict();
const avoid = z
  .object({ ...base, kind: z.literal("avoid"), avoid: z.string().min(1), instead: z.string().min(1) })
  .strict();
const contact = z
  .object({
    ...base,
    kind: z.literal("contact"),
    name: z.string().min(1),
    detail: z.string().optional(),
    number: z.string().min(3),
    hours: z
      .object({
        days: z.array(z.number().int().min(1).max(7)),
        open: z.string().regex(/^\d{2}:\d{2}$/),
        close: z.string().regex(/^\d{2}:\d{2}$/),
      })
      .strict()
      .optional(),
    layer: z.enum(["statewide", "service"]),
  })
  .strict();
const quote = z.object({ ...base, kind: z.literal("quote"), heading: z.string(), text: z.string().min(1) }).strict();
const steps = z
  .object({
    ...base,
    kind: z.literal("steps"),
    heading: z.string(),
    items: z
      .array(z.object({ title: z.string(), detail: z.string(), callContactId: z.string().optional() }).strict())
      .min(1),
  })
  .strict();
const links = z
  .object({
    ...base,
    kind: z.literal("links"),
    items: z.array(z.object({ label: z.string(), detail: z.string(), href: z.string().url() }).strict()).min(1),
  })
  .strict();
const note = z.object({ ...base, kind: z.literal("note"), heading: z.string(), text: z.string() }).strict();
const noteWording = z
  .object({ ...base, kind: z.literal("noteWording"), heading: z.string(), template: z.string().includes("[") })
  .strict();
const statusCall = z
  .object({ ...base, kind: z.literal("statusCall"), contactId: z.string(), fallbackContactId: z.string() })
  .strict();

export const blockSchema = z.discriminatedUnion("kind", [
  tip,
  avoid,
  contact,
  quote,
  steps,
  links,
  note,
  noteWording,
  statusCall,
]);
export type Block = z.infer<typeof blockSchema>;

export const sectionSchema = z
  .object({ id: z.string().min(1), tab: z.string().min(1), blocks: z.array(blockSchema) })
  .strict();
export type Section = z.infer<typeof sectionSchema>;

export const pageSchema = z
  .object({ id: z.enum(firstNationsPageIds), title: z.string(), sections: z.array(sectionSchema).min(1) })
  .strict();
export type Page = z.infer<typeof pageSchema>;

export const situationSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    hint: z.string(),
    steps: z
      .array(
        z
          .object({
            title: z.string(),
            detail: z.string(),
            blockRef: z.string().optional(),
            callContactId: z.string().optional(),
          })
          .strict(),
      )
      .min(3)
      .max(5),
  })
  .strict();
export type Situation = z.infer<typeof situationSchema>;

export const approvalSchema = z
  .object({
    sectionId: z.string(),
    body: z.string(),
    role: z.string(),
    date: day,
    reference: z.string(),
    contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type Approval = z.infer<typeof approvalSchema>;

export const profileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    hospitals: z.array(z.object({ id: z.string(), name: z.string() }).strict()),
    contacts: z.array(contact),
    acknowledgement: z.string().optional(),
    contentOwnerRole: z.string(),
    reportEmail: z.string().email().optional(),
  })
  .strict();
export type ServiceProfile = z.infer<typeof profileSchema>;

export const contentSchema = z
  .object({
    version: z.literal(1),
    pages: z.array(pageSchema).length(firstNationsPageIds.length),
    situations: z.array(situationSchema).length(6),
    statewideContacts: z.array(contact),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = new Set<string>();
    for (const page of value.pages)
      for (const section of page.sections)
        for (const block of section.blocks) {
          if (ids.has(block.id)) ctx.addIssue({ code: "custom", message: `Duplicate block id ${block.id}` });
          ids.add(block.id);
        }
  });
export type FirstNationsContent = z.infer<typeof contentSchema>;

export function parseFirstNationsContent(input: unknown): FirstNationsContent {
  const result = contentSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return result.data;
}
```

- [ ] **Step 4: Write `approval.ts`**

```ts
import { createHash } from "node:crypto";
import type { Approval, Section } from "@/lib/first-nations/content-schema";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

export function sectionApprovalState(section: Section, approvals: readonly Approval[]): "approved" | "awaiting" {
  const record = approvals.find((a) => a.sectionId === section.id);
  return record && record.contentSha256 === stableHash(section) ? "approved" : "awaiting";
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npm run test:focused -- --files tests/first-nations-approval.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/first-nations/content-schema.ts src/lib/first-nations/approval.ts tests/first-nations-approval.test.ts
git commit -m "First Nations: content schema and hash-pinned section approval"
```

---

### Task 2: Content files and loader

**Files:**

- Create: `src/data/first-nations/pages.json`, `src/data/first-nations/approvals.json`, `src/data/first-nations/profiles/emhs.json`, `src/lib/first-nations/content.ts`
- Test: `tests/first-nations-content.test.ts`

**Interfaces:**

- Consumes: `parseFirstNationsContent`, `approvalSchema`, `profileSchema` (Task 1); source ids (Task 0).
- Produces: `getFirstNationsPage(id: FirstNationsPageId): Page`, `getSituations(): Situation[]`, `getContacts(): ContactBlock[]` (statewide, plus service contacts only when the profile is enabled), `getApprovals(): Approval[]`, `getServiceProfile(): ServiceProfile | null` (null when disabled), `getSource(id): Source`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { getContacts, getFirstNationsPage, getServiceProfile, getSituations } from "@/lib/first-nations/content";
import { firstNationsPageIds } from "@/lib/first-nations/content-schema";
import sources from "@/data/first-nations/sources.json";

describe("First Nations content", () => {
  it("has all nine pages", () => {
    for (const id of firstNationsPageIds) expect(getFirstNationsPage(id).id).toBe(id);
  });
  it("has six situations whose references resolve", () => {
    const blockIds = new Set(
      firstNationsPageIds.flatMap((id) => getFirstNationsPage(id).sections.flatMap((s) => s.blocks.map((b) => b.id))),
    );
    for (const situation of getSituations())
      for (const step of situation.steps) if (step.blockRef) expect(blockIds.has(step.blockRef)).toBe(true);
  });
  it("references only registered sources", () => {
    const known = new Set(sources.sources.map((s) => s.id));
    for (const id of firstNationsPageIds)
      for (const s of getFirstNationsPage(id).sections)
        for (const b of s.blocks) expect(known.has(b.sourceId)).toBe(true);
  });
  it("hides the EMHS layer while it is disabled", () => {
    expect(getServiceProfile()).toBeNull();
    expect(getContacts().every((c) => c.layer === "statewide")).toBe(true);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm run test:focused -- --files tests/first-nations-content.test.ts`
Expected: FAIL, cannot resolve `@/lib/first-nations/content`.

- [ ] **Step 3: Write the data files.** `pages.json` follows `contentSchema`: nine pages with the tabs from the spec §3, tips and avoid items only from Task 0's register, the s 81 quote copied verbatim from `data/forms-cultural-notes.json` (forms 3A–3C), six situations (New admission, Mental Health Act, Wants to leave, Family meeting, Very unwell or dying, Going home) whose steps use `blockRef`/`callContactId`. `approvals.json` is `{ "version": 1, "approvals": [] }`. `profiles/emhs.json`:

```json
{
  "id": "emhs",
  "name": "East Metropolitan Health Service",
  "enabled": false,
  "hospitals": [{ "id": "rph", "name": "Royal Perth Hospital" }],
  "contacts": [],
  "contentOwnerRole": "EMHS Aboriginal Health (role to be confirmed in the agreement)"
}
```

(Real RPH team numbers are added only after Task 0 checks them, and stay invisible until `enabled` is set by a later PR carrying the agreement.)

- [ ] **Step 4: Write `content.ts`**

```ts
import pagesJson from "@/data/first-nations/pages.json";
import approvalsJson from "@/data/first-nations/approvals.json";
import emhsJson from "@/data/first-nations/profiles/emhs.json";
import sourcesJson from "@/data/first-nations/sources.json";
import { z } from "zod";
import {
  approvalSchema,
  parseFirstNationsContent,
  profileSchema,
  type Approval,
  type Block,
  type FirstNationsPageId,
  type Page,
  type ServiceProfile,
  type Situation,
} from "@/lib/first-nations/content-schema";

export type ContactBlock = Extract<Block, { kind: "contact" }>;
const sourceSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    publisher: z.string(),
    url: z.string().url(),
    aboriginalLed: z.boolean(),
    checkedAt: z.string(),
  })
  .strict();
export type Source = z.infer<typeof sourceSchema>;

const CONTENT = parseFirstNationsContent(pagesJson);
const APPROVALS: Approval[] = z
  .object({ version: z.literal(1), approvals: z.array(approvalSchema) })
  .strict()
  .parse(approvalsJson).approvals;
const PROFILE: ServiceProfile = profileSchema.parse(emhsJson);
const SOURCES = new Map(
  z
    .object({ version: z.literal(1), sources: z.array(sourceSchema) })
    .strict()
    .parse(sourcesJson)
    .sources.map((s) => [s.id, s]),
);

export function getFirstNationsPage(id: FirstNationsPageId): Page {
  const page = CONTENT.pages.find((p) => p.id === id);
  if (!page) throw new Error(`Missing First Nations page ${id}`);
  return page;
}
export const getSituations = (): Situation[] => CONTENT.situations;
export const getApprovals = (): Approval[] => APPROVALS;
export const getServiceProfile = (): ServiceProfile | null => (PROFILE.enabled ? PROFILE : null);
export function getContacts(): ContactBlock[] {
  return [...CONTENT.statewideContacts, ...(PROFILE.enabled ? PROFILE.contacts : [])];
}
export function getSource(id: string): Source {
  const source = SOURCES.get(id);
  if (!source) throw new Error(`Unknown First Nations source ${id}`);
  return source;
}
```

- [ ] **Step 5: Run and confirm pass**

Run: `npm run test:focused -- --files tests/first-nations-content.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/data/first-nations/pages.json src/data/first-nations/approvals.json src/data/first-nations/profiles/emhs.json src/lib/first-nations/content.ts tests/first-nations-content.test.ts
git commit -m "First Nations: statewide content, EMHS profile (disabled) and loader"
```

---

### Task 3: Content guard contract

**Files:**

- Test: `tests/first-nations-content-guard.test.ts`

**Interfaces:**

- Consumes: the raw JSON files under `src/data/first-nations/`.

- [ ] **Step 1: Write the test**

```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = "src/data/first-nations";
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
}
const all = files(ROOT).map((path) => ({ path, text: readFileSync(path, "utf8") }));

describe("First Nations content guard", () => {
  it("contains no mobile numbers", () => {
    for (const { path, text } of all) expect(text, path).not.toMatch(/\b04\d{2}[\s-]?\d{3}[\s-]?\d{3}\b|\+614\d{8}/);
  });
  it("never claims sign-off inside content", () => {
    for (const { path, text } of all)
      expect(text, path).not.toMatch(/"(reviewed|signedOff|signed_off|verified)"|"approved"\s*:\s*true/i);
  });
  it("names no individual staff (contacts are teams or switchboards)", () => {
    const pages = JSON.parse(readFileSync(join(ROOT, "pages.json"), "utf8")) as {
      statewideContacts: { name: string }[];
    };
    for (const c of pages.statewideContacts)
      expect(c.name).toMatch(/team|service|line|switchboard|liaison|interpreting|13YARN|health/i);
  });
  it("ships the EMHS layer disabled", () => {
    expect(JSON.parse(readFileSync(join(ROOT, "profiles/emhs.json"), "utf8")).enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm run test:focused -- --files tests/first-nations-content-guard.test.ts`
Expected: PASS (4 tests). If any fails, fix the data, never the test.

- [ ] **Step 3: Commit**

```bash
git add tests/first-nations-content-guard.test.ts
git commit -m "First Nations: guard content against mobiles, names and sign-off claims"
```

---

### Task 4: Opening hours and overdue logic

**Files:**

- Create: `src/lib/first-nations/hours.ts`
- Test: `tests/first-nations-hours.test.ts`

**Interfaces:**

- Consumes: `toAwstParts`, `fixedClock` from `src/lib/caring-contacts/clock.ts`; `isWaPublicHoliday` from `src/lib/on-call/wa-public-holidays.ts`.
- Produces: `type CallState = { kind: "open"; closesAt: string } | { kind: "closed"; opensAt: string | null } | { kind: "unconfirmed" }`; `callState(hours, checkedAt, now: Date): CallState`; `isOverdue(checkedAt: string, now: Date, maxDays = 90): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { callState, isOverdue } from "@/lib/first-nations/hours";

const weekdays = { days: [1, 2, 3, 4, 5], open: "08:00", close: "16:30" };
const at = (iso: string) => new Date(iso); // Perth is UTC+8, no daylight saving

describe("callState", () => {
  it("is open mid-morning on a weekday", () => {
    expect(callState(weekdays, "2026-09-01", at("2026-09-22T02:00:00Z"))).toEqual({ kind: "open", closesAt: "16:30" });
  });
  it("is closed at exactly the closing minute", () => {
    expect(callState(weekdays, "2026-09-01", at("2026-09-22T08:30:00Z")).kind).toBe("closed");
  });
  it("is closed at midnight", () => {
    expect(callState(weekdays, "2026-09-01", at("2026-09-22T16:00:00Z")).kind).toBe("closed");
  });
  it("is closed on a WA public holiday", () => {
    expect(callState(weekdays, "2026-09-01", at("2026-09-28T02:00:00Z")).kind).toBe("closed"); // King's Birthday WA 2026-09-28
  });
  it("is unconfirmed once the recheck is overdue, even in hours", () => {
    expect(callState(weekdays, "2026-06-01", at("2026-09-22T02:00:00Z"))).toEqual({ kind: "unconfirmed" });
  });
});

describe("isOverdue", () => {
  it("is false at 90 days and true at 91", () => {
    expect(isOverdue("2026-06-24", at("2026-09-22T02:00:00Z"))).toBe(false);
    expect(isOverdue("2026-06-23", at("2026-09-22T02:00:00Z"))).toBe(true);
  });
});
```

(Before relying on the holiday case, confirm `2026-09-28` is in `WA_PUBLIC_HOLIDAYS`; if the list says otherwise, use a date the list contains.)

- [ ] **Step 2: Run and confirm failure**

Run: `npm run test:focused -- --files tests/first-nations-hours.test.ts`
Expected: FAIL, cannot resolve `@/lib/first-nations/hours`.

- [ ] **Step 3: Implement**

```ts
import { toAwstParts } from "@/lib/caring-contacts/clock";
import { isWaPublicHoliday } from "@/lib/on-call/wa-public-holidays";

export type Hours = { days: number[]; open: string; close: string };
export type CallState =
  { kind: "open"; closesAt: string } | { kind: "closed"; opensAt: string | null } | { kind: "unconfirmed" };

const MS_PER_DAY = 86_400_000;
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function isOverdue(checkedAt: string, now: Date, maxDays = 90): boolean {
  const checked = Date.parse(`${checkedAt}T00:00:00+08:00`);
  return (
    (now.getTime() - checked) / MS_PER_DAY > maxDays + 1 - 1e-9 - 0 &&
    Math.floor((now.getTime() - checked) / MS_PER_DAY) > maxDays
  );
}

export function callState(hours: Hours | undefined, checkedAt: string, now: Date): CallState {
  if (!hours || isOverdue(checkedAt, now)) return { kind: "unconfirmed" };
  const parts = toAwstParts(now);
  const isoWeekday = parts.weekday === 0 ? 7 : parts.weekday;
  const nowMin = parts.hour * 60 + parts.minute;
  const openToday = hours.days.includes(isoWeekday) && !isWaPublicHoliday(now);
  if (openToday && nowMin >= minutes(hours.open) && nowMin < minutes(hours.close))
    return { kind: "open", closesAt: hours.close };
  return { kind: "closed", opensAt: openToday && nowMin < minutes(hours.open) ? hours.open : null };
}
```

Check `AwstParts` field names in `src/lib/caring-contacts/clock.ts` before running (`weekday`, `hour`, `minute`); adjust the three property reads to match, and simplify `isOverdue` to `Math.floor((now - checked) / MS_PER_DAY) > maxDays` if the tests pass with it (they should).

- [ ] **Step 4: Run and confirm pass**

Run: `npm run test:focused -- --files tests/first-nations-hours.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/first-nations/hours.ts tests/first-nations-hours.test.ts
git commit -m "First Nations: Perth-time opening hours with holiday and overdue handling"
```

---

### Task 5: Mode registration, routes and nav header

**Files:**

- Modify: `src/lib/app-modes.ts` (`appModeIds` near `:26`, definition after My Work `:587-613`, `namespaceIsolatedModes` `:656`)
- Modify: `src/lib/category-identity.ts` (`APP_MODE_ICON` `:131`, `APP_MODE_ACCENT` `:169`)
- Modify: `src/lib/information-pages.ts` (`:27`, `:98`, `:141`)
- Modify: `src/lib/mode-secondary-navigation.ts` (after `:181`)
- Modify: `src/components/mode-nav/mode-nav-icons.ts` (`iconByItemId`, `:42`)
- Modify: `src/lib/phone-mode-groups.ts` (after `:49-54`)
- Modify: `src/lib/search-command-surface.ts` (after `:249-260`)
- Modify: `src/lib/search-route-ownership.ts` (`:56`, `:113-114`, `:180`)
- Modify: `src/lib/search-shell-props.ts` (after `:116-117`)
- Modify: `src/lib/site-content/site-content-registry.ts` (`:19`, after `:303-310`)
- Modify: `src/lib/ui-copy.ts` (after `:138-142`), `src/lib/universal-search-mode-context.ts` (`:38`)
- Modify: `src/components/clinical-dashboard/ClinicalSidebar.tsx:115`, `src/components/clinical-dashboard/use-sidebar-pins.ts:32`
- Modify: `src/components/mode-nav/header-addon-slot.ts` (`:26-80`)
- Modify: `scripts/generate-site-map.ts` (`:182`, `:300`, `:485`, `:630-637`), `docs/design-system/adoption-contract.json` (sorted `routes` from `:120`)
- Create: `src/app/(search-app)/first-nations/page.tsx`, `loading.tsx`, and `contacts|talking|family|mental-health|on-the-ward|mistakes|going-home|end-of-life/page.tsx`
- Create: `src/components/first-nations/first-nations-nav-header.tsx`
- Modify tests: `tests/app-modes.test.ts:223,482`, `tests/mode-secondary-navigation.test.ts:67,90,94,120,124,126`, `tests/ui-copy.test.ts:128,140`, `tests/ui-smoke.spec.ts:4537,4538-4543,4558`, `tests/design-system-adoption.test.ts:1479`, `tests/phone-mode-groups.test.ts:39-47`, `tests/mode-home-loading-contract.test.ts:36`, `tests/site-content-registry.test.ts:327`, `tests/collapsed-rail-active-mode.dom.test.tsx:54`, `tests/mode-nav-addon-slot.dom.test.tsx` (`:52-111`, cover list `:134-155`, claimants `:250-335`)

**Interfaces:**

- Consumes: nothing from Tasks 1–4 (pages render a placeholder `<FirstNationsPageRenderer pageId=… />` stub until Task 6; the stub returns the page title only).
- Produces: `FirstNationsNavHeader({ pageId }: { pageId: FirstNationsPageId })`, route files calling `<FirstNationsPageRenderer pageId="…" />`.

- [ ] **Step 1: Update the count pins first so they fail.** Change every `20` in the pins above to `21`, `106` to `115` (nine new `page.tsx`), and add `"first-nations"` rows beside each `"my-work"` row with the values below. Add `"src/components/first-nations/first-nations-nav-header.tsx"` to the sorted claimant list.

- [ ] **Step 2: Run and confirm failure**

Run: `npm run test:focused -- --files tests/app-modes.test.ts tests/mode-secondary-navigation.test.ts tests/ui-copy.test.ts tests/phone-mode-groups.test.ts tests/mode-home-loading-contract.test.ts tests/site-content-registry.test.ts tests/collapsed-rail-active-mode.dom.test.tsx tests/mode-nav-addon-slot.dom.test.tsx`
Expected: FAIL on the counts and the missing mode.

- [ ] **Step 3: Register the mode.** Key additions:

```ts
// app-modes.ts — appModeIds
"first-nations",
// app-modes.ts — definition (same shape as my-work)
{
  id: "first-nations",
  label: "First Nations",
  description: "Culturally safe care for Aboriginal and Torres Strait Islander patients",
  href: "/first-nations",
  search: { kind: "tools", placeholder: "Search First Nations care tips and contacts", resultKind: "tools", resultsSurface: "none", nextStep: "Open a page", badgeLabel: null },
},
// category-identity.ts
"first-nations": "users",        // APP_MODE_ICON (use an existing icon key; D1/D5 answers may change it)
"first-nations": "eucalyptus",   // APP_MODE_ACCENT — add the accent key if the union lacks it, else "slate"
// mode-secondary-navigation.ts
"first-nations": [
  { id: "first-nations-bedside", label: "Bedside", href: "/first-nations" },
  { id: "first-nations-contacts", label: "Contacts", href: "/first-nations/contacts" },
  { id: "first-nations-talking", label: "Talking", href: "/first-nations/talking" },
  { id: "first-nations-family", label: "Family", href: "/first-nations/family" },
  { id: "first-nations-mental-health", label: "Mental health", href: "/first-nations/mental-health" },
  { id: "first-nations-on-the-ward", label: "On the ward", href: "/first-nations/on-the-ward" },
  { id: "first-nations-mistakes", label: "Common mistakes", href: "/first-nations/mistakes" },
  { id: "first-nations-going-home", label: "Going home", href: "/first-nations/going-home" },
  { id: "first-nations-end-of-life", label: "End of life", href: "/first-nations/end-of-life" },
],
// mode-nav-icons.ts iconByItemId (ids are prefixed so On Call's "contacts" icon is not shared)
"first-nations-bedside": BedDouble, "first-nations-contacts": Phone, "first-nations-talking": MessageCircle,
"first-nations-family": Users, "first-nations-mental-health": Brain, "first-nations-on-the-ward": Shield,
"first-nations-mistakes": TriangleAlert, "first-nations-going-home": DoorOpen, "first-nations-end-of-life": Feather,
// phone-mode-groups.ts (after my-work)
{ id: "first-nations", label: "First Nations", hint: "Culturally safe care", modeIds: ["first-nations"] },
// search-route-ownership.ts
"/first-nations",                       // standaloneModeHomePaths and alwaysStandaloneShellPathPrefixes
case "first-nations": return "/first-nations";
// search-shell-props.ts
if (pathname === "/first-nations") return { initialMode: "first-nations", desktopSearchPlacement: "hero" };
// site-content-registry.ts
{ modeId: "first-nations", reason: "operational_chrome", permanent: true, reviewed: true, reviewOwner: "clinical_content_governance" },
// information-pages.ts
| "first-nations"
if (pathname === "/first-nations" || pathname.startsWith("/first-nations/")) return true;
// header-addon-slot.ts
if (pathname === "/first-nations" || isSlugDetail(pathname, "/first-nations")) return true;
```

Add the `ui-copy.ts` presentation (`title: "First Nations"`, `subtitle: "Culturally safe care for Aboriginal and Torres Strait Islander patients"`, three suggestions "Call Aboriginal liaison", "Common mistakes", "Mental Health Act s 81"), the `search-command-surface.ts` entry (`remoteSearchEnabled: false`, `crossModes: ["on-call", "services", "forms"]` — use existing mode ids), `universal-search-mode-context.ts` `"first-nations": []`, the two sidebar lists, and the site-map rows. Let `npm run typecheck` name any other exhaustive record.

- [ ] **Step 4: Create the routes.** Home:

```tsx
// src/app/(search-app)/first-nations/page.tsx
import type { Metadata } from "next";
import { FirstNationsPageRenderer } from "@/components/first-nations/page-renderer";

export const metadata: Metadata = {
  title: "First Nations | PsychSift",
  description: "Culturally safe care for Aboriginal and Torres Strait Islander patients.",
};
export default function FirstNationsHomeRoute() {
  return <FirstNationsPageRenderer pageId="bedside" />;
}
```

```tsx
// src/app/(search-app)/first-nations/loading.tsx
import { ModeHomeRouteLoading } from "@/components/mode-home-page-skeleton";
export default function Loading() {
  return <ModeHomeRouteLoading />;
}
```

Each section route is the same with its own `pageId` and title, e.g. `contacts/page.tsx` → `title: "Contacts | First Nations | PsychSift"`, `pageId="contacts"`.

- [ ] **Step 5: Create the nav header**, following `OnCallSectionNavHeader` (`src/components/on-call/on-call-nav-header.tsx:124-158`):

```tsx
"use client";
import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import { useInPageSectionNav } from "@/components/in-page-nav/use-in-page-section-nav";
import type { PageSection } from "@/components/in-page-nav/page-section-index";

export function FirstNationsNavHeader({ title, sections }: { title: string; sections: readonly PageSection[] }) {
  const { sections: resolved, activeId, selectSection } = useInPageSectionNav(sections);
  if (resolved.length === 0) return null;
  return (
    <InPageNavHeader
      title={title}
      titleHidden
      sections={resolved}
      activeId={activeId}
      onSelectSection={selectSection}
      rail={{ label: "Sections of this page", density: "balanced-four", modeIdentity: "first-nations" }}
      className="max-sm:border-b-0 max-sm:bg-transparent"
      testIdPrefix="first-nations-section-header"
    />
  );
}
```

(Import paths: confirm `useInPageSectionNav` and `PageSection` locations against `on-call-nav-header.tsx`'s imports and copy them exactly.)

- [ ] **Step 6: Run and confirm pass**

Run: `npm run typecheck && npm run test:focused -- --files tests/app-modes.test.ts tests/mode-secondary-navigation.test.ts tests/ui-copy.test.ts tests/phone-mode-groups.test.ts tests/mode-home-loading-contract.test.ts tests/site-content-registry.test.ts tests/collapsed-rail-active-mode.dom.test.tsx tests/mode-nav-addon-slot.dom.test.tsx`
Expected: typecheck clean; all listed tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/app-modes.ts src/lib/category-identity.ts src/lib/information-pages.ts src/lib/mode-secondary-navigation.ts src/components/mode-nav/mode-nav-icons.ts src/lib/phone-mode-groups.ts src/lib/search-command-surface.ts src/lib/search-route-ownership.ts src/lib/search-shell-props.ts src/lib/site-content/site-content-registry.ts src/lib/ui-copy.ts src/lib/universal-search-mode-context.ts src/components/clinical-dashboard/ClinicalSidebar.tsx src/components/clinical-dashboard/use-sidebar-pins.ts src/components/mode-nav/header-addon-slot.ts scripts/generate-site-map.ts docs/design-system/adoption-contract.json "src/app/(search-app)/first-nations" src/components/first-nations/first-nations-nav-header.tsx tests/app-modes.test.ts tests/mode-secondary-navigation.test.ts tests/ui-copy.test.ts tests/ui-smoke.spec.ts tests/design-system-adoption.test.ts tests/phone-mode-groups.test.ts tests/mode-home-loading-contract.test.ts tests/site-content-registry.test.ts tests/collapsed-rail-active-mode.dom.test.tsx tests/mode-nav-addon-slot.dom.test.tsx
git commit -m "First Nations: register the mode, nine routes and nav header"
```

---

### Task 6: Server renderer, blocks and crisis block

**Files:**

- Create: `src/components/first-nations/page-renderer.tsx`, `blocks.tsx`, `crisis-block.tsx`
- Test: `tests/first-nations-renderer.dom.test.tsx`

**Interfaces:**

- Consumes: `getFirstNationsPage`, `getApprovals`, `getSource`, `getContacts` (Task 2); `sectionApprovalState` (Task 1); `FirstNationsNavHeader` (Task 5); `WA_CRISIS_CONTACTS` from `src/lib/crisis-contacts.ts`.
- Produces: `FirstNationsPageRenderer({ pageId })`; `renderBlock(block, state)`; `CrisisBlock()`.

- [ ] **Step 1: Write the failing DOM test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionBlocks } from "@/components/first-nations/blocks";
import { CrisisBlock } from "@/components/first-nations/crisis-block";

const tip = {
  kind: "tip",
  id: "t1",
  do: "Ask who they want involved",
  why: "The decision-maker may not be the next of kin.",
  sourceId: "src-a",
  checkedAt: "2026-09-26",
} as const;
const wording = {
  kind: "noteWording",
  id: "w1",
  heading: "Note wording",
  template: "Collaborated with [role].",
  sourceId: "src-a",
  checkedAt: "2026-09-26",
} as const;
const source = {
  id: "src-a",
  title: "Example guide",
  publisher: "WA Health",
  url: "https://example.org/guide",
  aboriginalLed: true,
  checkedAt: "2026-09-26",
};

describe("First Nations blocks", () => {
  it("shows a credited tip with an awaiting chip when not approved", () => {
    render(<SectionBlocks blocks={[tip]} approval="awaiting" sources={{ "src-a": source }} />);
    expect(screen.getByText("Ask who they want involved")).toBeTruthy();
    expect(screen.getByText(/Example guide/)).toBeTruthy();
    expect(screen.getByText("Awaiting service approval")).toBeTruthy();
  });
  it("hides our own note wording until approved", () => {
    render(<SectionBlocks blocks={[wording]} approval="awaiting" sources={{ "src-a": source }} />);
    expect(screen.queryByText(/Collaborated with/)).toBeNull();
  });
  it("renders 13YARN in the crisis block", () => {
    render(<CrisisBlock />);
    expect(screen.getByRole("link", { name: /13 92 76/ }).getAttribute("href")).toBe("tel:139276");
  });
});
```

(Check `PublicCrisisContact.telephoneUri` for 13YARN in `src/lib/crisis-contacts.ts:110-112` and match the expected `href`.)

- [ ] **Step 2: Run and confirm failure**

Run: `npm run test:focused -- --files tests/first-nations-renderer.dom.test.tsx`
Expected: FAIL, missing modules.

- [ ] **Step 3: Implement `blocks.tsx`** (server component; no `"use client"`):

```tsx
import type { Block } from "@/lib/first-nations/content-schema";
import type { Source } from "@/lib/first-nations/content";

type Props = { blocks: readonly Block[]; approval: "approved" | "awaiting"; sources: Record<string, Source> };

function SourceLine({ source, checkedAt }: { source: Source; checkedAt: string }) {
  return (
    <p className="text-xs text-[var(--text-muted)]">
      From{" "}
      <a href={source.url} className="underline-offset-2 hover:underline">
        {source.title}
      </a>{" "}
      · Checked{" "}
      <time dateTime={checkedAt} className="nums">
        {checkedAt}
      </time>
    </p>
  );
}

export function SectionBlocks({ blocks, approval, sources }: Props) {
  return (
    <div className="grid gap-3">
      {blocks.map((block) => {
        const source = sources[block.sourceId];
        if (block.kind === "noteWording" && approval !== "approved") return null;
        if (block.kind === "tip") {
          return (
            <article
              key={block.id}
              className="grid gap-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4"
            >
              <h3 className="text-[length:var(--text-body)] font-medium text-[var(--text-heading)]">{block.do}</h3>
              <p className="text-[length:var(--text-sm)] text-[var(--text)]">
                <span className="mr-1 text-2xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[var(--text-muted)]">
                  Why
                </span>
                {block.why}
              </p>
              {source ? <SourceLine source={source} checkedAt={block.checkedAt} /> : null}
              {approval === "awaiting" ? (
                <span className="justify-self-start rounded-[6px] border px-2 py-0.5 text-xs">
                  Awaiting service approval
                </span>
              ) : null}
            </article>
          );
        }
        if (block.kind === "avoid") {
          return (
            <article
              key={block.id}
              className="grid gap-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4"
            >
              <p className="text-2xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[var(--text-muted)]">
                Avoid
              </p>
              <h3 className="text-[length:var(--text-body)] font-medium text-[var(--text-heading)]">{block.avoid}</h3>
              <p className="text-[length:var(--text-sm)]">
                <span className="mr-1 text-2xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[var(--text-muted)]">
                  Instead
                </span>
                {block.instead}
              </p>
              {source ? <SourceLine source={source} checkedAt={block.checkedAt} /> : null}
            </article>
          );
        }
        if (block.kind === "quote") {
          return (
            <figure
              key={block.id}
              className="grid gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4"
            >
              <figcaption className="text-[length:var(--text-body)] font-medium">{block.heading}</figcaption>
              <blockquote className="border-l-2 border-[var(--mode-identity)] pl-3 text-[length:var(--text-sm)] leading-[var(--leading-prose)]">
                {block.text}
              </blockquote>
              {source ? <SourceLine source={source} checkedAt={block.checkedAt} /> : null}
            </figure>
          );
        }
        // steps, links, note, contact, noteWording(approved), statusCall are rendered by their own components
        return null;
      })}
    </div>
  );
}
```

Replace the utility spellings above with the repo's token utilities where they exist (check `docs/design-system/README.md` and neighbouring On Call components); the lint rules (hex, type scale) must pass. Add the `steps`, `links`, `note`, `contact` (server shell that mounts `ContactActions` from Task 7) and approved `noteWording` branches in the same style.

- [ ] **Step 4: Implement `crisis-block.tsx`**

```tsx
import { WA_CRISIS_CONTACTS } from "@/lib/crisis-contacts";

const IDS = ["SYN-001", "SYN-007", "SYN-002", "SYN-005"] as const; // 000, 13YARN, MHERL metro, Lifeline — confirm ids in crisis-contacts.ts

export function CrisisBlock() {
  const contacts = IDS.map((id) => {
    const c = WA_CRISIS_CONTACTS.find((x) => x.id === id);
    if (!c) throw new Error(`Missing crisis contact ${id}`);
    return c;
  });
  return (
    <section
      aria-label="Crisis numbers"
      className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3"
    >
      <h2 className="text-2xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[var(--text-muted)]">
        Crisis
      </h2>
      {contacts.map((c) => (
        <a
          key={c.id}
          href={`tel:${c.telephoneUri}`}
          className={`nums min-h-12 inline-flex items-center rounded-full border px-3 text-[length:var(--text-sm)] font-normal ${c.telephoneDisplay === "000" ? "border-[var(--danger-border)] text-[var(--danger-text)]" : "border-[var(--border)]"}`}
        >
          {c.name === c.telephoneDisplay ? c.telephoneDisplay : `${c.name} ${c.telephoneDisplay}`}
        </a>
      ))}
    </section>
  );
}
```

- [ ] **Step 5: Implement `page-renderer.tsx`** (server): read the page, compute `sectionApprovalState` per section with `getApprovals()`, build `PageSection[]` from `section.id`/`section.tab`, render `<FirstNationsNavHeader>`, each section as `<section id={section.id}>` with `<SectionBlocks>`, and `<CrisisBlock />` at the end of every page (Bedside also mounts `StatusCallCard`, the situations tiles and the three fixed tips). Replace the Task 5 stub.

- [ ] **Step 6: Run and confirm pass**

Run: `npm run test:focused -- --files tests/first-nations-renderer.dom.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/first-nations/page-renderer.tsx src/components/first-nations/blocks.tsx src/components/first-nations/crisis-block.tsx tests/first-nations-renderer.dom.test.tsx
git commit -m "First Nations: server renderer, credited blocks and crisis numbers"
```

---

### Task 7: Client islands — call card, contact actions, situations, primer

**Files:**

- Create: `src/lib/first-nations/contact-format.ts`, `src/components/first-nations/status-call-card.tsx`, `contact-actions.tsx`, `situation-sheet.tsx`, `primer.tsx`
- Modify: `src/lib/account-scoped-browser-state.ts` (add `FIRST_NATIONS_HOSPITAL_STORAGE_KEY` and clear it at `:59`)
- Test: `tests/first-nations-contact-format.test.ts`, `tests/first-nations-islands.dom.test.tsx`

**Interfaces:**

- Consumes: `callState` (Task 4); `onCallTelHref` from `src/lib/on-call/home-modules.ts:189`; `CopyButton` from `src/components/ui/copy-button.tsx`; `systemClock` from `src/lib/caring-contacts/clock.ts`.
- Produces: `formatForDisplay(raw)`, `telHref(raw)`, `vcardFor({ name, number }): string`; `StatusCallCard({ contact, fallback })`; `ContactActions({ name, number, reportEmail? })`; `SituationSheet({ situations, contactsById })`; `Primer()`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/first-nations-contact-format.test.ts
import { describe, expect, it } from "vitest";
import { telHref, vcardFor } from "@/lib/first-nations/contact-format";

describe("contact format", () => {
  it("builds a tel link for a landline", () => {
    expect(telHref("(08) 9000 0012")).toBe("tel:0890000012");
  });
  it("builds a minimal vCard with the team name and number only", () => {
    const card = vcardFor({ name: "Aboriginal liaison team", number: "(08) 9000 0012" });
    expect(card).toContain("FN:Aboriginal liaison team");
    expect(card).toContain("TEL;TYPE=WORK:0890000012");
    expect(card).not.toMatch(/EMAIL|ADR|NOTE/);
  });
});
```

```tsx
// tests/first-nations-islands.dom.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactActions } from "@/components/first-nations/contact-actions";
import { SituationSheet } from "@/components/first-nations/situation-sheet";

afterEach(() => vi.restoreAllMocks());

describe("ContactActions", () => {
  it("falls back to copying when Web Share is missing", async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: write }, configurable: true });
    render(<ContactActions name="Aboriginal liaison team" number="(08) 9000 0012" />);
    fireEvent.click(screen.getByRole("button", { name: /send to a colleague/i }));
    expect(write).toHaveBeenCalledWith("Aboriginal liaison team: (08) 9000 0012");
    expect(await screen.findByText("Copied")).toBeTruthy();
  });
});

describe("SituationSheet", () => {
  it("keeps ticks in memory only", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(
      <SituationSheet
        situations={[
          {
            id: "mha",
            label: "Mental Health Act",
            hint: "s 81",
            steps: [
              { title: "Call an Aboriginal mental health worker", detail: "If practicable." },
              { title: "Ask who is significant", detail: "Family, Elders." },
              { title: "Record it", detail: "Who, or why not." },
            ],
          },
        ]}
        contactsById={{}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Mental Health Act/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Call an Aboriginal mental health worker/ }));
    expect(setItem).not.toHaveBeenCalled();
    expect(screen.getByText(/aren't saved/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm run test:focused -- --files tests/first-nations-contact-format.test.ts tests/first-nations-islands.dom.test.tsx`
Expected: FAIL, missing modules.

- [ ] **Step 3: Implement `contact-format.ts`**

```ts
export function digitsOnly(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}
export function telHref(raw: string): string {
  return `tel:${digitsOnly(raw)}`;
}
export function vcardFor({ name, number }: { name: string; number: string }): string {
  return ["BEGIN:VCARD", "VERSION:3.0", `FN:${name}`, `TEL;TYPE=WORK:${digitsOnly(number)}`, "END:VCARD", ""].join(
    "\r\n",
  );
}
```

- [ ] **Step 4: Implement `contact-actions.tsx`** (`"use client"`): a row with a `tel:` link ("Call", `min-h-12`), `CopyButton` for the number, "Send to a colleague" (uses `navigator.share({ text })` when present, else `navigator.clipboard.writeText(text)` and shows "Copied"), "Save to my phone" (creates a `Blob` from `vcardFor`, `URL.createObjectURL`, downloads `"<name>.vcf"`, revokes the URL), and "Report a wrong number" (a `mailto:` link to `reportEmail` with subject "Wrong number: <name>" and a body naming the number; hidden when no address). All icon-only buttons carry text labels.

- [ ] **Step 5: Implement `status-call-card.tsx`** (`"use client"`): initial render shows "Hours not confirmed" (matches the server HTML), then a `useEffect` computes `callState(contact.hours, contact.checkedAt, systemClock().now())` and re-checks every 60 s. Open → "Open until 16:30" and "Call Aboriginal liaison"; closed → "Closed · opens 08:00" (or "Closed") and the button becomes "Call switchboard" with the fallback number; unconfirmed → "Hours not confirmed", both numbers shown, switchboard first. Numbers use `font-normal nums`. The number itself is always visible.

- [ ] **Step 6: Implement `situation-sheet.tsx`** (`"use client"`): six tiles; tapping one opens a bottom sheet (reuse the app's sheet/dialog primitive used by the pages sheet; check `master-search-header.tsx` for the component name) with the steps as checkboxes held in `useState`, a line "Ticks aren't saved and clear when you leave", and inline call buttons for steps with `callContactId`. Closing the sheet clears ticks.

- [ ] **Step 7: Implement `primer.tsx`** (`"use client"`): reads a per-device flag `first-nations-primer-dismissed` in `try/catch` localStorage; shows the three lines and "Got it" once; the ••• menu can reopen it. Add `FIRST_NATIONS_HOSPITAL_STORAGE_KEY = "first-nations-hospital"` to `account-scoped-browser-state.ts` and include it in `clearAccountScopedBrowserStorage()`.

- [ ] **Step 8: Run and confirm pass**

Run: `npm run test:focused -- --files tests/first-nations-contact-format.test.ts tests/first-nations-islands.dom.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/first-nations/contact-format.ts src/components/first-nations/status-call-card.tsx src/components/first-nations/contact-actions.tsx src/components/first-nations/situation-sheet.tsx src/components/first-nations/primer.tsx src/lib/account-scoped-browser-state.ts tests/first-nations-contact-format.test.ts tests/first-nations-islands.dom.test.tsx
git commit -m "First Nations: call card, contact actions, situations and primer"
```

---

### Task 8: Pocket card, links in, mode colour, type-weight guard, organisation map

**Files:**

- Create: `src/components/first-nations/pocket-card.tsx`, `src/app/(search-app)/first-nations/card/page.tsx`
- Modify: `src/app/globals.css` (add `[data-mode-identity="first-nations"]` beside On Call's block at `:1084-1121`, light, `.dark`, and forced-colours)
- Modify: the Forms cultural-note view for forms 3A–3C (find the component that calls `culturalNotesForForm`, `src/lib/forms-cultural-notes.ts:56`) and `services-navigator-page.tsx` to add one link each into the mode
- Modify: `docs/organisation/systems/clinical-content.json` (add `"src/data/first-nations/**"`, `"src/lib/first-nations/**"`), `docs/organisation/systems/app-experience.json` (add `"src/components/first-nations/**"`, `"tests/first-nations-*"`)
- Test: `tests/first-nations-type-weight.test.ts`, `tests/first-nations-pocket-card.dom.test.tsx`

**Interfaces:**

- Consumes: `getContacts`, `getServiceProfile` (Task 2); `CrisisBlock` (Task 6).
- Produces: `/first-nations/card` print route.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/first-nations-type-weight.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = "src/components/first-nations";
describe("First Nations type weight", () => {
  it("uses nothing heavier than font-semibold", () => {
    for (const f of readdirSync(DIR)) {
      const text = readFileSync(join(DIR, f), "utf8");
      expect(text, f).not.toMatch(/\bfont-(bold|extrabold|black)\b|font-weight:\s*(7|8|9)00/);
    }
  });
});
```

```tsx
// tests/first-nations-pocket-card.dom.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PocketCard } from "@/components/first-nations/pocket-card";

describe("PocketCard", () => {
  it("prints crisis numbers and no service numbers while the service layer is off", () => {
    render(<PocketCard />);
    expect(screen.getByText(/13 92 76/)).toBeTruthy();
    expect(screen.queryByText(/Royal Perth/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm run test:focused -- --files tests/first-nations-type-weight.test.ts tests/first-nations-pocket-card.dom.test.tsx`
Expected: FAIL on the missing pocket card (the weight test may already pass).

- [ ] **Step 3: Implement the pocket card** at badge size (default per D4 unless Josh chose otherwise): statewide liaison/switchboard contacts from `getContacts()` (service contacts appear only when enabled), plus `CrisisBlock`, with `@media print` sizing. Route `card/page.tsx` titled "Pocket card | First Nations | PsychSift"; add it to the site map and adoption contract, and bump the adoption count pin from 115 to 116.

- [ ] **Step 4: Add the mode colour** (D1 default "deep eucalyptus"; placeholder values, contrast-checked by the existing tests):

```css
[data-mode-identity="first-nations"] {
  --mode-identity: #3f5a4c;
  --mode-identity-soft: #eef3f0;
  --mode-identity-border: #cfdcd4;
  --mode-identity-contrast: #fff;
}
.dark [data-mode-identity="first-nations"] {
  --mode-identity: #a9c7b6;
  --mode-identity-soft: #16201b;
  --mode-identity-border: #2c3d34;
  --mode-identity-contrast: #0b0e11;
}
```

Copy the remaining remaps and the forced-colours block from On Call's section so the structure matches exactly.

- [ ] **Step 5: Add the two links in** (Forms 3A–3C cultural note: "Open First Nations mental health"; Services with the Aboriginal filter: "Open First Nations contacts"), and the organisation-map globs.

- [ ] **Step 6: Run and confirm pass**

Run: `npm run test:focused -- --files tests/first-nations-type-weight.test.ts tests/first-nations-pocket-card.dom.test.tsx tests/design-token-contract.test.ts tests/live-control-contrast.dom.test.tsx && npm run check:organisation`
Expected: PASS; organisation reports 0 unplaced.

- [ ] **Step 7: Commit**

```bash
git add src/components/first-nations/pocket-card.tsx "src/app/(search-app)/first-nations/card/page.tsx" src/app/globals.css docs/organisation/systems/clinical-content.json docs/organisation/systems/app-experience.json tests/first-nations-type-weight.test.ts tests/first-nations-pocket-card.dom.test.tsx
git add <the Forms and Services files changed in Step 5>
git commit -m "First Nations: pocket card, links in, mode colour, weight guard and organisation map"
```

---

- [ ] **Step 8a: "Log as CPD" in the ••• menu (CPD integration, coordinator 2026-09-26)**

Every First Nations page's ••• menu gets one "Log as CPD" item. It uses CPD's existing prefill helper and carries the page, never anything about a patient; opening the form logs nothing until the doctor saves. CPD's "Next step" points to `/first-nations/talking` when its "Culturally safe practice" domain has nothing logged, so that route must stay stable.

```ts
// src/components/first-nations/first-nations-nav-header.tsx (menu items)
import { cmeLearningFromSourceHref } from "@/lib/cme/learning-source";

const cpdHref = cmeLearningFromSourceHref({
  title: `First Nations: ${page.title}`,
  href: `/first-nations${page.slug ? `/${page.slug}` : ""}`,
});
// render only when cpdHref is not null: <Link href={cpdHref}>Log as CPD</Link>
```

```ts
// tests/first-nations-cpd-link.test.ts
import { describe, expect, it } from "vitest";
import { cmeLearningFromSourceHref } from "@/lib/cme/learning-source";

describe("First Nations Log as CPD", () => {
  it("prefills the page title and route only", () => {
    const href = cmeLearningFromSourceHref({ title: "First Nations: Talking", href: "/first-nations/talking" });
    expect(href).toBe("/cme/new?title=First+Nations%3A+Talking&sourceUrl=%2Ffirst-nations%2Ftalking");
  });
});
```

Run: `npm run test:focused -- --files tests/first-nations-cpd-link.test.ts`
Expected: PASS.

### Task 9: Generated files, full local proof, PR

**Files:**

- Regenerate: `docs/site-map.md`, `docs/design-system/ADOPTION.md`, `docs/design-system/adoption-manifest.json`, `data/repo-awareness-snapshot.json`

- [ ] **Step 1: Merge latest main** (sibling new-mode threads change the same pins): `git fetch origin main && git merge origin/main`, then re-derive every count pin from Task 5 against the merged tree.

- [ ] **Step 2: Regenerate**

Run: `npm run sitemap:update && npm run design-system:adoption:update && npm run snapshot:repo-awareness`

- [ ] **Step 3: Local proof**

Run: `npm run typecheck && npm run lint && npm run test:focused -- --files tests/first-nations-approval.test.ts tests/first-nations-content.test.ts tests/first-nations-content-guard.test.ts tests/first-nations-hours.test.ts tests/first-nations-renderer.dom.test.tsx tests/first-nations-contact-format.test.ts tests/first-nations-islands.dom.test.tsx tests/first-nations-type-weight.test.ts tests/first-nations-pocket-card.dom.test.tsx tests/app-modes.test.ts tests/mode-secondary-navigation.test.ts tests/ui-copy.test.ts tests/phone-mode-groups.test.ts tests/mode-home-loading-contract.test.ts tests/site-content-registry.test.ts tests/collapsed-rail-active-mode.dom.test.tsx tests/mode-nav-addon-slot.dom.test.tsx tests/design-system-adoption.test.ts tests/site-map.test.ts tests/route-reachability.test.ts && npm run check:organisation`
Expected: all green. Paste the decisive summary lines into the PR body.

- [ ] **Step 4: Visual check against the design standard.** `npm run ensure`, then screenshot `/first-nations`, `/first-nations/contacts` and `/first-nations/mistakes` at 390 × 844 in light and dark next to live On Call and CPD. Fix anything heavier, busier or more colourful. List the states checked (loaded, loading, empty, offline, error; signed out equals loaded) in the PR body.

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add docs/site-map.md docs/design-system/ADOPTION.md docs/design-system/adoption-manifest.json data/repo-awareness-snapshot.json
git add <any files reformatted by Prettier, named individually>
git commit -m "First Nations: regenerate site map, adoption manifest and repo snapshot"
```

- [ ] **Step 6: Push and open the PR** (ready, not draft; `plan:browser` escalates to the full Chromium suite in CI):

```bash
git push -u origin claude/project-thread-ac8rlk
```

Open the PR with the GitHub MCP tools using the repository's PR template. Body includes: `RAG impact: no retrieval behaviour change — no retrieval, ranking or ingestion files touched`; "No database change"; the local proof lines; "Full browser suite left to CI". Send the PR to the merge lineup thread through the coordinator.

---

## Self-review

- **Spec coverage.** §1–2 scope and decisions: Global Constraints, Tasks 2–3. §3 pages and navigation: Tasks 5–6. §4 content model and approval: Tasks 1–3. §5 behaviours: hours (4, 7), crisis (6), ticks (7), note wording (6), contact actions (7), hospital choice (7), primer (7), pocket card (8), links in (8). §6 privacy: Task 3 guard, Task 7 vCard minimal, no storage of ticks. §7 design: Global Constraints, Task 8 weight guard and colour, Task 9 visual check. §8 files: File Structure. §9 tests: Tasks 1–9. §10 build route: Tasks 5–9. §11 go-live items are outside this PR (EMHS layer stays disabled). §12 out of scope: Global Constraints.
- **Placeholders.** Content text is supplied by Task 0's checked register rather than invented here, by design: the owner rule forbids unverified cultural or clinical text.
- **Types.** `Section`, `Block`, `Approval`, `ServiceProfile`, `FirstNationsPageId`, `ContactBlock`, `Source`, `CallState` are defined once and reused with the same names.
