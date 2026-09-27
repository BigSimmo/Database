import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lower-case id with hyphens.");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM.");
const credit = { sourceId: z.string().min(1), checkedAt: day };
const base = { id: slug, ...credit };

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

export const FIRST_NATIONS_PAGE_TITLES: Record<FirstNationsPageId, string> = {
  bedside: "Bedside",
  contacts: "Contacts",
  talking: "Talking",
  family: "Family",
  "mental-health": "Mental health",
  "on-the-ward": "On the ward",
  mistakes: "Common mistakes",
  "going-home": "Going home",
  "end-of-life": "End of life",
};

export function firstNationsPageHref(id: FirstNationsPageId): string {
  return id === "bedside" ? "/first-nations" : `/first-nations/${id}`;
}

export const situationIds = [
  "new-admission",
  "wants-to-leave",
  "family-meeting",
  "mental-health-act",
  "sorry-business",
  "going-home",
] as const;
export type SituationId = (typeof situationIds)[number];

export const SITUATION_LABELS: Record<SituationId, string> = {
  "new-admission": "New admission",
  "wants-to-leave": "Wants to leave",
  "family-meeting": "Family meeting",
  "mental-health-act": "Mental Health Act",
  "sorry-business": "Sorry Business",
  "going-home": "Going home",
};

export const moduleIcons = [
  "users",
  "phone",
  "message",
  "check",
  "clipboard",
  "brain",
  "house",
  "map-pin",
  "feather",
  "scale",
  "shield",
  "book",
  "door",
  "bed",
] as const;
export type ModuleIcon = (typeof moduleIcons)[number];

export const moduleLayouts = [
  "list",
  "tiles",
  "deck",
  "numbered",
  "steps",
  "quote",
  "service-contacts",
  "where-is-home",
] as const;
export type ModuleLayout = (typeof moduleLayouts)[number];

const hours = z.object({ days: z.array(z.number().int().min(1).max(7)).min(1), open: hhmm, close: hhmm }).strict();

const tip = z
  .object({
    ...base,
    kind: z.literal("tip"),
    do: z.string().min(1),
    why: z.string().min(1),
    say: z.string().min(1).optional(),
  })
  .strict();
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
    hours: hours.optional(),
    layer: z.enum(["statewide", "service"]),
  })
  .strict();
const quote = z
  .object({ ...base, kind: z.literal("quote"), heading: z.string().min(1), text: z.string().min(1) })
  .strict();
const steps = z
  .object({
    ...base,
    kind: z.literal("steps"),
    heading: z.string().min(1),
    items: z.array(z.object({ title: z.string().min(1), detail: z.string() }).strict()).min(1),
  })
  .strict();
const linkItem = z.object({ label: z.string().min(1), detail: z.string(), href: z.string().url() }).strict();
const linkList = z
  .object({ ...base, kind: z.literal("linkList"), heading: z.string().min(1), items: z.array(linkItem).min(1) })
  .strict();
const note = z
  .object({ ...base, kind: z.literal("note"), heading: z.string().min(1), text: z.string().min(1) })
  .strict();
const noteWording = z
  .object({
    ...base,
    kind: z.literal("noteWording"),
    heading: z.string().min(1),
    template: z.string().includes("[blank]"),
  })
  .strict();

export const blockSchema = z.discriminatedUnion("kind", [
  tip,
  avoid,
  contact,
  quote,
  steps,
  linkList,
  note,
  noteWording,
]);
export type Block = z.infer<typeof blockSchema>;
export type ContactBlock = z.infer<typeof contact>;
export type NoteBlock = z.infer<typeof note>;

const EMPTY_LAYOUTS: readonly ModuleLayout[] = ["service-contacts", "where-is-home"];

export const moduleSchema = z
  .object({
    id: slug,
    title: z.string().min(1),
    icon: z.enum(moduleIcons),
    layout: z.enum(moduleLayouts),
    blocks: z.array(blockSchema),
  })
  .strict()
  .superRefine((m, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message: `${m.id}: ${message}` });
    const takesNone = EMPTY_LAYOUTS.includes(m.layout);
    if (takesNone && m.blocks.length > 0) fail("this layout takes no blocks");
    if (!takesNone && m.blocks.length === 0) fail("needs at least one block");
    if (m.layout === "tiles" && (m.blocks.length !== 4 || m.blocks.some((b) => b.kind !== "contact")))
      fail("tiles hold exactly four contacts");
    if (m.layout === "deck" && m.blocks.some((b) => b.kind !== "tip" || !b.say))
      fail("a deck holds tips with words to say");
    if (m.layout === "numbered" && m.blocks.some((b) => b.kind !== "avoid")) fail("numbered cards hold avoid items");
    if (m.layout === "quote" && m.blocks.some((b) => b.kind !== "quote")) fail("a quote module holds quotes");
    if (m.layout === "steps" && m.blocks.some((b) => b.kind !== "steps" && b.kind !== "tip"))
      fail("a steps module holds steps or tips");
  });
export type Module = z.infer<typeof moduleSchema>;

export const sectionSchema = z
  .object({ id: slug, tab: z.string().min(1).max(20), modules: z.array(moduleSchema).min(1) })
  .strict();
export type Section = z.infer<typeof sectionSchema>;

export const pageSchema = z
  .object({ id: z.enum(firstNationsPageIds), title: z.string().min(1), sections: z.array(sectionSchema).min(1) })
  .strict();
export type Page = z.infer<typeof pageSchema>;

const phrase = z.object({ say: z.string().min(1), why: z.string().min(1), ...credit }).strict();

export const situationSchema = z
  .object({
    id: z.enum(situationIds),
    label: z.string().min(1),
    icon: z.enum(moduleIcons),
    phrases: z.array(phrase).length(3, "Each situation has exactly three phrases."),
    firstStepRef: slug,
    plan: z.array(slug).min(3, "A plan has 3 to 5 steps.").max(5, "A plan has 3 to 5 steps."),
    riskLineRef: slug.optional(),
  })
  .strict();
export type Situation = z.infer<typeof situationSchema>;

export const regionSchema = z
  .object({
    id: slug,
    label: z.string().min(1),
    serviceContactIds: z.array(slug).min(1),
    languages: z.array(z.string().min(1)),
    ...credit,
  })
  .strict();
export type Region = z.infer<typeof regionSchema>;

export const approvalSchema = z
  .object({
    subjectId: z.string().min(1),
    body: z.string().min(1),
    role: z.string().min(1),
    date: day,
    reference: z.string().min(1),
    contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type Approval = z.infer<typeof approvalSchema>;

export const profileSchema = z
  .object({
    id: slug,
    name: z.string().min(1),
    enabled: z.boolean(),
    hospitals: z.array(
      z.object({ id: slug, name: z.string().min(1), liaisonContactId: slug, switchboardContactId: slug }).strict(),
    ),
    contacts: z.array(contact),
    acknowledgement: z.string().min(1).optional(),
    contentOwnerRole: z.string().min(1),
    reportEmail: z.string().email().optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    const ids = new Set(p.contacts.map((c) => c.id));
    for (const h of p.hospitals)
      for (const ref of [h.liaisonContactId, h.switchboardContactId])
        if (!ids.has(ref)) ctx.addIssue({ code: "custom", message: `${h.id}: unknown contact ${ref}` });
  });
export type ServiceProfile = z.infer<typeof profileSchema>;

export const sourceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    publisher: z.string().min(1),
    url: z.string().url(),
    aboriginalLed: z.boolean(),
    checkedAt: day,
  })
  .strict();
export type Source = z.infer<typeof sourceSchema>;

export const mapSchema = z
  .object({
    version: z.literal(1),
    ...credit,
    viewBox: z.string().regex(/^0 0 \d+(\.\d+)? \d+(\.\d+)?$/),
    /** Plain-language note about how the outline was drawn (for example, that it is schematic). */
    note: z.string().min(1).optional(),
    regions: z.array(z.object({ id: slug, path: z.string().startsWith("M") }).strict()).min(1),
  })
  .strict();
export type WaMap = z.infer<typeof mapSchema>;

const STEP_KINDS = new Set<Block["kind"]>(["tip", "note", "contact"]);

export const contentSchema = z
  .object({
    version: z.literal(1),
    pages: z.array(pageSchema).length(firstNationsPageIds.length),
    situations: z.array(situationSchema).length(situationIds.length, "There are exactly six situations."),
    riskLines: z.array(note),
    statewideContacts: z.array(contact),
    interpreterContactId: slug,
    regions: z.array(regionSchema).min(1),
    reportEmail: z.string().email().optional(),
    training: linkItem
      .extend({ ...credit })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    value.situations.forEach((s, i) => {
      if (s.id !== situationIds[i]) fail(`Situation ${i + 1} must be ${situationIds[i]}`);
      if (s.label !== SITUATION_LABELS[s.id]) fail(`${s.id} must be labelled "${SITUATION_LABELS[s.id]}"`);
    });
    for (const id of firstNationsPageIds) if (!value.pages.some((p) => p.id === id)) fail(`Missing page ${id}`);

    const blocks = new Map<string, Block>();
    const add = (b: Block) => {
      if (blocks.has(b.id)) fail(`Duplicate block id ${b.id}`);
      blocks.set(b.id, b);
    };
    for (const page of value.pages)
      for (const section of page.sections) for (const mod of section.modules) mod.blocks.forEach(add);
    value.statewideContacts.forEach(add);
    const riskIds = new Set(value.riskLines.map((r) => r.id));
    value.riskLines.forEach(add);

    for (const s of value.situations) {
      for (const ref of [s.firstStepRef, ...s.plan]) {
        const b = blocks.get(ref);
        if (!b || riskIds.has(ref) || !STEP_KINDS.has(b.kind))
          fail(`${s.id}: step ${ref} must name a tip, note or contact`);
      }
      const isWantsToLeave = s.id === "wants-to-leave";
      if (isWantsToLeave !== Boolean(s.riskLineRef))
        fail(`${s.id}: only "Wants to leave" carries the immediate-risk line`);
      if (s.riskLineRef && !riskIds.has(s.riskLineRef)) fail(`${s.id}: unknown risk line ${s.riskLineRef}`);
    }

    const contactIds = new Set(value.statewideContacts.map((c) => c.id));
    if (!contactIds.has(value.interpreterContactId)) fail(`Unknown interpreter contact ${value.interpreterContactId}`);
    for (const r of value.regions)
      for (const id of r.serviceContactIds) if (!contactIds.has(id)) fail(`${r.id}: unknown contact ${id}`);
  });
export type FirstNationsContent = z.infer<typeof contentSchema>;

export function parseFirstNationsContent(input: unknown): FirstNationsContent {
  const result = contentSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return result.data;
}
