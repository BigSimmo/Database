import { type OnCallEntry } from "@/lib/on-call/entry-model";
import { ON_CALL_HOME_TAGS } from "@/lib/on-call/home-modules";

/**
 * The demo shift.
 *
 * Two fixture rows used to stand in for this whole mode, which meant demo mode
 * showed a hub with no call cards, no wards, no reminder, no sections worth
 * opening — a visitor saw the empty state of every screen and learned nothing
 * about what On Call is for. It also left the eleven artboards untestable in a
 * browser: you cannot assert that a drawn module renders when there is no data
 * that would make it render.
 *
 * So this is a whole synthetic shift, sized to exercise every element of the
 * drawing: two call-first contacts and a switchboard, four wards, a pinned
 * escalation, dated teaching, tagged referrals, an orientation checklist, a
 * private logistics group, and role explainers.
 *
 * **Everything here must stay obviously synthetic.** Every organisation is
 * "Demo", every number is a run of zeroes with a single distinguishing digit,
 * and nothing states a clinical fact — no dose, no threshold, no criterion.
 * A demo corpus that looks real is worse than an empty one: it is a hospital
 * directory a visitor might act on. The playbook entry below is escalation
 * only, which is what THE PLAYBOOK RULE permits it to be.
 */

/** Recognisably fake, and consistent: `0000 000 00N`. */
function demoNumber(n: number): string {
  return `0000 000 0${`${n}`.padStart(2, "0")}`;
}

function id(n: number): string {
  return `00000000-0000-4000-8000-${`${n}`.padStart(12, "0")}`;
}

/**
 * Dated relative to the day the page is read, so "Coming up" is never empty and
 * never shows a session in the past. Built at UTC noon for the same reason
 * `weekdayLabel` is: a bare date must not shift a day under a timezone.
 */
function demoDateKey(daysAhead: number): string {
  const day = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return `${day.getUTCFullYear()}-${`${day.getUTCMonth() + 1}`.padStart(2, "0")}-${`${day.getUTCDate()}`.padStart(2, "0")}`;
}

type DemoEntry = Omit<OnCallEntry, "createdAt" | "updatedAt">;

function entry(row: DemoEntry): OnCallEntry {
  return row as OnCallEntry;
}

/** Never verified, so the freshness badge and the "needs checking" group both appear. */
const NEVER_VERIFIED = null;
const VERIFIED_RECENTLY = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

export const DEMO_ON_CALL_ENTRIES: readonly OnCallEntry[] = [
  // ---- Contacts: the home's call cards, switchboard and ward strip ----
  entry({
    id: id(1),
    section: "contacts",
    slug: "demo-nurse-manager",
    title: "Demo nurse manager, after hours",
    subtitle: "Example entry shown in demo mode",
    body: null,
    details: { role: "Nurse manager", phone: demoNumber(1), availability: "Always" },
    linkedDocumentIds: [],
    tags: [ON_CALL_HOME_TAGS.callFirst, "Tonight"],
    isPersonal: false,
    includeOnCard: true,
    sortOrder: 0,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(2),
    section: "contacts",
    slug: "demo-registrar-on-call",
    title: "Demo registrar on call",
    subtitle: "Example entry shown in demo mode",
    body: null,
    details: { role: "Registrar on call", phone: demoNumber(2), availability: "From 17:00" },
    linkedDocumentIds: [],
    tags: [ON_CALL_HOME_TAGS.callFirst, "Tonight"],
    isPersonal: false,
    includeOnCard: true,
    sortOrder: 1,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(3),
    section: "contacts",
    slug: "demo-switchboard",
    title: "Demo Hospital switchboard",
    subtitle: "For the consultant, and anyone off this list",
    body: null,
    details: { role: "Switchboard operator", phone: demoNumber(9) },
    linkedDocumentIds: [],
    tags: [ON_CALL_HOME_TAGS.switchboard, "Tonight"],
    isPersonal: false,
    includeOnCard: true,
    sortOrder: 2,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(4),
    section: "contacts",
    slug: "demo-ward-one",
    title: "Demo Ward One",
    subtitle: "Nurses' station",
    body: null,
    details: { role: "Ward nurses' station", extension: "0001" },
    linkedDocumentIds: [],
    tags: [ON_CALL_HOME_TAGS.ward, "Wards"],
    isPersonal: false,
    includeOnCard: true,
    sortOrder: 3,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(5),
    section: "contacts",
    slug: "demo-ward-two",
    title: "Demo Ward Two",
    subtitle: "Nurses' station",
    body: null,
    details: { role: "Ward nurses' station", extension: "0002" },
    linkedDocumentIds: [],
    tags: [ON_CALL_HOME_TAGS.ward, "Wards"],
    isPersonal: false,
    includeOnCard: true,
    sortOrder: 4,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(6),
    section: "contacts",
    slug: "demo-emergency-department",
    title: "Demo Emergency Department",
    subtitle: "Nurses' station",
    body: null,
    details: { role: "Emergency department", extension: "0003" },
    linkedDocumentIds: [],
    tags: [ON_CALL_HOME_TAGS.ward, "Wards"],
    isPersonal: false,
    includeOnCard: true,
    sortOrder: 5,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(7),
    section: "contacts",
    slug: "demo-interpreter-line",
    title: "Demo interpreter line",
    subtitle: "Example entry shown in demo mode",
    body: null,
    details: { role: "Interpreter service", phone: demoNumber(4), availability: "24 hours" },
    linkedDocumentIds: [],
    tags: ["Services"],
    isPersonal: false,
    includeOnCard: true,
    sortOrder: 6,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(8),
    section: "contacts",
    slug: "demo-bed-management",
    title: "Demo bed management, after hours",
    subtitle: "Example entry shown in demo mode",
    body: null,
    details: { role: "Bed management", phone: demoNumber(5) },
    linkedDocumentIds: [],
    tags: ["Admin"],
    isPersonal: false,
    includeOnCard: false,
    // Never confirmed, so the "needs checking" group and the overdue badge both
    // have something to show.
    sortOrder: 7,
    lastVerifiedAt: NEVER_VERIFIED,
  }),
  entry({
    id: id(9),
    section: "contacts",
    slug: "demo-private-line",
    title: "Demo private line",
    subtitle: "Example private entry shown in demo mode",
    body: null,
    details: { role: "Example personal contact", phone: demoNumber(6) },
    linkedDocumentIds: [],
    tags: ["Tonight"],
    // The one private row, so the "Private · only you" treatment — flag shown,
    // digits withheld — is visible in demo mode rather than only in a test.
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 8,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),

  // ---- Who's who: role explainers, filed in contacts ----
  entry({
    id: id(10),
    section: "contacts",
    slug: "demo-role-registrar",
    title: "What the registrar on call does",
    subtitle: "Anything you cannot settle with the nurse in charge",
    body: "Placeholder role description shown only in demo mode.",
    details: { role: "Registrar on call", kind: "role-explainer" },
    linkedDocumentIds: [],
    tags: ["Roles"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(11),
    section: "contacts",
    slug: "demo-role-consultant",
    title: "What the consultant on call does",
    subtitle: "Decisions the registrar cannot make alone",
    body: "Placeholder role description shown only in demo mode.",
    details: { role: "Consultant on call", kind: "role-explainer" },
    linkedDocumentIds: [],
    tags: ["Roles"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 1,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),

  // ---- Playbook: the pinned reminder, a ladder, and one with no guideline ----
  entry({
    id: id(20),
    section: "playbook",
    slug: "demo-escalation-pinned",
    title: "You are expected to wake the demo consultant.",
    subtitle: "Any decision the registrar cannot make alone. The Playbook has the ladder.",
    body: null,
    details: {
      trigger: "Example escalation scenario shown in demo mode",
      escalationSteps: [
        { order: 1, whoToCall: "Nurse in charge, on the ward", when: "First, before any call." },
        {
          order: 2,
          whoToCall: "Demo registrar on call",
          when: "If it is unresolved after five minutes.",
          phone: demoNumber(2),
        },
        {
          order: 3,
          whoToCall: "Demo consultant on call",
          when: "If the registrar is unreachable for ten minutes. You are expected to make this call.",
          phone: demoNumber(9),
        },
      ],
    },
    linkedDocumentIds: [],
    tags: [ON_CALL_HOME_TAGS.pinned],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(21),
    section: "playbook",
    slug: "demo-escalation-second",
    title: "Demo escalation — system unavailable",
    subtitle: null,
    body: null,
    details: {
      trigger: "Example escalation scenario shown in demo mode",
      escalationSteps: [
        { order: 1, whoToCall: "Ward clerk", when: "First." },
        { order: 2, whoToCall: "Demo IT service desk", when: "If it is still down after ten minutes." },
      ],
    },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 1,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),

  // ---- Referrals: tagged, so the chip row has something to filter ----
  entry({
    id: id(30),
    section: "referrals",
    slug: "demo-community-team",
    title: "Demo community mental health team",
    subtitle: "Weekdays only",
    body: null,
    details: {
      accepts: ["Example acceptance criterion shown in demo mode"],
      exclusions: ["Example exclusion shown in demo mode"],
      catchment: "Demo catchment",
      hours: "Weekdays, business hours",
      howToRefer: "Placeholder referral process shown only in demo mode.",
      phone: demoNumber(7),
    },
    linkedDocumentIds: [],
    tags: ["Community"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(31),
    section: "referrals",
    slug: "demo-youth-service",
    title: "Demo youth service",
    subtitle: "Seven days",
    body: null,
    details: {
      accepts: ["Example acceptance criterion shown in demo mode"],
      exclusions: ["Example exclusion shown in demo mode"],
      hours: "Seven days",
      phone: demoNumber(8),
    },
    linkedDocumentIds: [],
    tags: ["Youth"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 1,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),

  // ---- Orientation: the two checklists the drawing gives board 10 ----
  entry({
    id: id(40),
    section: "orientation",
    slug: "demo-first-fifteen-minutes",
    title: "Your first fifteen minutes",
    subtitle: "Example checklist shown in demo mode",
    body: "Placeholder orientation note shown only in demo mode.",
    details: {
      pinnedSummaryIsOwnerNote: true,
      checklist: [
        { text: "Collect the on-call phone", note: "Demo Ward One nurses' station" },
        { text: "Introduce yourself to the nurse in charge" },
        { text: "Check your keycard opens the on-call room" },
      ],
    },
    linkedDocumentIds: [],
    tags: ["Starting"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(41),
    section: "orientation",
    slug: "demo-before-you-leave",
    title: "Before you leave",
    subtitle: "Example checklist shown in demo mode",
    body: null,
    details: {
      pinnedSummaryIsOwnerNote: true,
      checklist: [
        { text: "Return the on-call phone and pager" },
        { text: "Hand back the keycard", note: "Not doing this is what gets chased for months." },
        { text: "Finish outstanding notes" },
      ],
    },
    linkedDocumentIds: [],
    tags: ["Finishing"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 1,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),

  // ---- Teaching: dated, so "Coming up" has something to rank ----
  entry({
    id: id(50),
    section: "education",
    slug: "demo-registrar-teaching",
    title: "Demo registrar teaching",
    subtitle: "Example session shown in demo mode",
    body: null,
    details: {
      recurrence: "Weekly in term",
      nextOccurrence: "Next week, 08:00",
      nextOccurrenceDate: demoDateKey(3),
      location: "Demo seminar room",
      presenter: "Demo presenter",
    },
    linkedDocumentIds: [],
    tags: ["Teaching"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(51),
    section: "education",
    slug: "demo-journal-club",
    title: "Demo journal club",
    subtitle: "Example session shown in demo mode",
    body: null,
    details: {
      recurrence: "Monthly",
      nextOccurrence: "Later this month, 13:00",
      nextOccurrenceDate: demoDateKey(12),
      location: "Demo seminar room",
    },
    linkedDocumentIds: [],
    tags: ["Teaching"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 1,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),

  // ---- Logistics: an ordinary group, and a wholly private one ----
  entry({
    id: id(60),
    section: "logistics",
    slug: "demo-on-call-room",
    title: "Demo on-call room",
    subtitle: null,
    body: null,
    details: { category: "Where", location: "Demo level 2, past the lifts" },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(61),
    section: "logistics",
    slug: "demo-food-after-hours",
    title: "Demo food after hours",
    subtitle: null,
    body: null,
    details: { category: "Where", location: "Demo level 1 foyer", hours: "Vending only after 19:30" },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 1,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(62),
    section: "logistics",
    slug: "demo-security-escort",
    title: "Demo security escort",
    subtitle: null,
    body: null,
    details: { category: "Where", phone: demoNumber(3) },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 2,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(63),
    section: "logistics",
    slug: "demo-after-hours-entry",
    title: "Demo after-hours entry",
    subtitle: "Which door, and what to do when the card fails",
    body: null,
    // The whole group is private, so board 11's in-card explanation renders.
    // No credential is stated: the point of the entry is that the answer is
    // withheld, which is exactly what the section is allowed to hold.
    details: { category: "Getting in" },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 3,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(64),
    section: "logistics",
    slug: "demo-locked-wards",
    title: "Demo locked wards",
    subtitle: "And who can let you through",
    body: null,
    details: { category: "Getting in" },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 4,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(65),
    section: "logistics",
    slug: "demo-taxi-home",
    title: "A taxi home after a night shift",
    subtitle: "Yours to authorise in this demo",
    body: null,
    details: { category: "What you can authorise" },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 5,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
];
