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
 * escalation, dated teaching, tagged referrals, orientation folders and
 * checklists, the six Admin folders, a wholly private one, every Compliance
 * consequence band — all of them private — and role explainers.
 *
 * **Everything here must stay obviously synthetic.** Every employer is "Demo",
 * every number is a run of zeroes with a single distinguishing digit, every
 * link is `example.org`, and nothing states a clinical fact — no dose, no
 * threshold, no criterion. A demo corpus that looks real is worse than an empty
 * one: it is a hospital directory a visitor might act on. The playbook entry
 * below is escalation only, which is what THE PLAYBOOK RULE permits it to be.
 *
 * The exception is the names of the bodies that actually issue a requirement —
 * Ahpra, RANZCP, the Department of Communities. A compliance row whose issuer
 * read "Demo registration board" would teach a visitor the wrong word for the
 * one thing this page exists to help them chase, and `issuingBody` carries no
 * contact detail: it is recorded so the holder knows who to ask.
 *
 * **No row may say a requirement is held, current, valid or in order.** Nothing
 * here — and nothing in the real data this stands in for — is checked with an
 * issuing body, so the corpus states what was recorded, who issues it, and how
 * the date came to be believed, and leaves the verdict to the reader.
 *
 * **Every compliance row is private**, which is a property of the real data
 * and not a fixture convenience — a doctor's registration, indemnity and
 * clearances are not the ward numbers the shared read was opened up for. The
 * reasoning sits with the rows themselves, at the Compliance block below.
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

  // ---- Orientation: folders, two checklists, and one manual left unfiled ----
  //
  // `details.category` is the folder heading. It is optional in the schema
  // because orientation rows already existed without one, so the last row here
  // carries none on purpose: a row with no folder is the only thing that puts
  // the fallback heading ("Unfiled") on screen, and an unexercised fallback is
  // one nobody notices has broken.
  //
  // One word per folder, like the Admin block below and for the same measured
  // reason: the folder is a slot in a 48px bar of bare words, where a phrase
  // truncates on a 320px phone. The manual titled "Before you leave" keeps that
  // title on its own card; only the folder above it is shortened to
  // "Departure".
  entry({
    id: id(40),
    section: "orientation",
    slug: "demo-first-fifteen-minutes",
    title: "Your first fifteen minutes",
    subtitle: "Example checklist shown in demo mode",
    body: "Placeholder orientation note shown only in demo mode.",
    details: {
      pinnedSummaryIsOwnerNote: true,
      category: "Induction",
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
    id: id(42),
    section: "orientation",
    slug: "demo-ward-one-manual",
    title: "Demo Ward One manual",
    subtitle: "How the ward runs its own day",
    body: null,
    details: { pinnedSummaryIsOwnerNote: true, category: "Manuals" },
    linkedDocumentIds: [],
    tags: ["Wards"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 1,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(43),
    section: "orientation",
    slug: "demo-emergency-department-manual",
    title: "Demo Emergency Department manual",
    subtitle: "Who to find, and where the assessment rooms are",
    body: null,
    details: { pinnedSummaryIsOwnerNote: true, category: "Manuals" },
    linkedDocumentIds: [],
    tags: ["Wards"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 2,
    lastVerifiedAt: NEVER_VERIFIED,
  }),
  entry({
    id: id(44),
    section: "orientation",
    slug: "demo-after-hours-policy-index",
    title: "Demo after-hours policy index",
    subtitle: "Example index shown in demo mode",
    body: "Placeholder pointer shown only in demo mode. The policies themselves live in your own documents.",
    details: { pinnedSummaryIsOwnerNote: true, category: "Policies" },
    linkedDocumentIds: [],
    tags: ["Policies"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 3,
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
      category: "Departure",
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
    sortOrder: 4,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(45),
    section: "orientation",
    slug: "demo-orientation-handbook",
    title: "Demo orientation handbook",
    subtitle: "The whole-of-service one, sent before you start",
    body: null,
    // Deliberately unfiled — see the note at the top of this block.
    details: { pinnedSummaryIsOwnerNote: true },
    linkedDocumentIds: [],
    tags: ["Starting"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 5,
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

  // ---- Admin: the work admin a doctor does for themselves ----
  //
  // The section id is still `logistics` and always will be — it is a database
  // CHECK constraint — but what it holds is now leave, rosters, pay, forms and
  // access, with Facilities kept as one folder so the rooms-and-food rows that
  // predate the change are not orphaned.
  //
  // ONE WORD PER CATEGORY, and this corpus is where that convention is modelled
  // in a browser. `category` is the group heading AND a slot in the page's
  // in-page navigation bar, which draws bare words that truncate rather than
  // fold (`wordmark-five` in src/components/mode-nav/mode-nav-bands.ts). "What
  // you can authorise" measured 165px in that row against a 288px phone
  // viewport and was cut to "Authorise" — see `tests/ui-on-call-boards.spec.ts`
  // (board 11), which is the record of the measurement.
  //
  // A phrase reads fine in review and truncates on the phone this mode is
  // opened on at 3am, so "Rosters and hours" is "Rosters", "Pay and claims" is
  // "Pay", and "IT and access" is "Access". If a folder seems to need a phrase,
  // the answer is a better word, not a wider bar. The editor's
  // `ADMIN_CATEGORY_OPTIONS` is the same list and carries the same note.
  entry({
    id: id(66),
    section: "logistics",
    slug: "demo-sick-leave",
    title: "Demo sick leave, and who to tell first",
    subtitle: "Before the shift starts, wherever that is possible",
    body: "Placeholder administrative note shown only in demo mode.",
    details: { category: "Leave", url: "https://example.org/demo-sick-leave" },
    linkedDocumentIds: [],
    tags: ["Leave"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(67),
    section: "logistics",
    slug: "demo-professional-development-leave",
    title: "Demo professional development leave (PDL)",
    subtitle: "How to apply, and what the allowance covers",
    body: null,
    details: { category: "Leave", url: "https://example.org/demo-pdl" },
    linkedDocumentIds: [],
    tags: ["Leave"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 1,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(68),
    section: "logistics",
    slug: "demo-annual-and-parental-leave",
    title: "Demo annual and parental leave",
    subtitle: "How far ahead a request has to go in",
    body: null,
    details: { category: "Leave" },
    linkedDocumentIds: [],
    tags: ["Leave"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 2,
    lastVerifiedAt: NEVER_VERIFIED,
  }),
  entry({
    id: id(69),
    section: "logistics",
    slug: "demo-roster-requests",
    title: "Demo roster requests and shift swaps",
    subtitle: "Who approves a swap, and by when",
    body: null,
    details: { category: "Rosters", hours: "Weekdays, business hours", phone: demoNumber(10) },
    linkedDocumentIds: [],
    tags: ["Roster"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 3,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(70),
    section: "logistics",
    slug: "demo-overtime-and-toil",
    title: "Demo overtime and time off in lieu (TOIL)",
    subtitle: "What to record, and where it goes",
    body: null,
    details: { category: "Rosters" },
    linkedDocumentIds: [],
    tags: ["Roster"],
    isPersonal: false,
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
    body: "Placeholder fatigue note shown only in demo mode.",
    details: { category: "Rosters" },
    linkedDocumentIds: [],
    tags: ["Roster"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 5,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(71),
    section: "logistics",
    slug: "demo-payslips",
    title: "Demo payslips and pay queries",
    subtitle: null,
    body: null,
    details: { category: "Pay", hours: "Weekdays, business hours", phone: demoNumber(20) },
    linkedDocumentIds: [],
    tags: ["Pay"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 6,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(72),
    section: "logistics",
    slug: "demo-on-call-allowance",
    title: "Demo on-call allowance and overtime claims",
    subtitle: "Claim in the fortnight you worked it",
    body: null,
    details: { category: "Pay" },
    linkedDocumentIds: [],
    tags: ["Pay"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 7,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(73),
    section: "logistics",
    slug: "demo-salary-packaging",
    title: "Demo salary packaging and reimbursements",
    subtitle: null,
    body: null,
    details: { category: "Pay", url: "https://example.org/demo-salary-packaging" },
    linkedDocumentIds: [],
    tags: ["Pay"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 8,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(74),
    section: "logistics",
    slug: "demo-forms-index",
    title: "Where the demo forms live",
    subtitle: "One index, so nothing is hunted for twice",
    body: null,
    details: { category: "Forms", url: "https://example.org/demo-forms" },
    linkedDocumentIds: [],
    tags: ["Forms"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 9,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(75),
    section: "logistics",
    slug: "demo-leave-application-form",
    title: "Demo leave application form",
    subtitle: null,
    body: null,
    details: { category: "Forms", url: "https://example.org/demo-leave-form" },
    linkedDocumentIds: [],
    tags: ["Forms"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 10,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(76),
    section: "logistics",
    slug: "demo-expense-claim-form",
    title: "Demo expense claim form",
    subtitle: null,
    body: null,
    details: { category: "Forms", url: "https://example.org/demo-expense-claim" },
    linkedDocumentIds: [],
    tags: ["Forms"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 11,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  // Every row in this folder is private, so board 11's in-card explanation of
  // the private treatment renders. No credential is stated anywhere in it: the
  // point of these rows is that the answer is withheld, which is exactly what
  // the section is allowed to hold.
  entry({
    id: id(63),
    section: "logistics",
    slug: "demo-after-hours-entry",
    title: "Demo after-hours entry",
    subtitle: "Which door, and what to do when the card fails",
    body: null,
    details: { category: "Access" },
    linkedDocumentIds: [],
    tags: ["Access"],
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 12,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(64),
    section: "logistics",
    slug: "demo-locked-wards",
    title: "Demo locked wards",
    subtitle: "And who can let you through",
    body: null,
    details: { category: "Access" },
    linkedDocumentIds: [],
    tags: ["Access"],
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 13,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(77),
    section: "logistics",
    slug: "demo-logins-and-remote-access",
    title: "Demo logins, paging and remote access",
    subtitle: "Who to ask, and how long it takes",
    body: "Placeholder note shown only in demo mode. No login is recorded here.",
    details: { category: "Access" },
    linkedDocumentIds: [],
    tags: ["Access"],
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 14,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(60),
    section: "logistics",
    slug: "demo-on-call-room",
    title: "Demo on-call room",
    subtitle: null,
    body: null,
    details: { category: "Facilities", location: "Demo level 2, past the lifts" },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 15,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(61),
    section: "logistics",
    slug: "demo-food-after-hours",
    title: "Demo food after hours",
    subtitle: null,
    body: null,
    details: { category: "Facilities", location: "Demo level 1 foyer", hours: "Vending only after 19:30" },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 16,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(62),
    section: "logistics",
    slug: "demo-security-escort",
    title: "Demo security escort",
    subtitle: null,
    body: null,
    details: { category: "Facilities", phone: demoNumber(3) },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 17,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),

  // ---- Compliance: Admin rows whose point is that they expire ----
  //
  // Same stored section, told apart by `details.kind` — see
  // src/lib/on-call/compliance.ts. The page sorts on `consequence`, not on the
  // date, so the corpus carries every band: two that stop you working, two that
  // stop part of the work, three that get you chased, and one with no
  // consequence recorded at all, which is the band a reader most needs to see
  // rendered rather than guessed at.
  //
  // `expiresOn` is dated relative to today, like the teaching sessions above,
  // so the spread survives the corpus being read a year from now: one lapsed,
  // one within the month, and the rest out to a year.
  //
  // `category` is one word here too. It renders as a pill on the row rather
  // than as a heading — this page groups by band, not by category — but the
  // owner picks it from the same editor as the Admin folders, and two naming
  // conventions inside one editor is how the long ones creep back.
  //
  // **Nothing here is checked with an issuing body**, so no row states one is
  // held, current or in order. Each says what was recorded, who issues it, and
  // how the date came to be believed (`provenance`) — and leaves the judgement
  // to the reader.
  //
  // **Every row here is `isPersonal: true`, and that is not a demo detail.**
  // The 2026-09-04 owner decision that lets an anonymous caller read the
  // non-personal entries was about ward numbers and escalation ladders — the
  // things a covering doctor needs at 3am without an account. It was never
  // about a named doctor's registration, indemnity, credentialing, Working
  // with Children Check and police clearance, which is an identity dossier and
  // has no business on a page a visitor can open. Compliance rows are
  // therefore written private, and the corpus models what the app produces
  // rather than the defect it used to. Demo mode serves every row regardless
  // of the flag (the route never reaches the shared-read predicate), so the
  // page still fills for a visitor with no account.
  //
  // Because the whole page is private by construction, the page states it once
  // in `ComplianceScopeNote` instead of hanging a "Private" pill off all eight
  // rows — see `on-call-compliance-section.tsx`. Unset the flag on any row
  // here and the page notices: the pills come back and the page-level sentence
  // goes away, because a blanket claim over a mixed page would be false.
  entry({
    id: id(80),
    section: "logistics",
    slug: "demo-medical-registration",
    title: "Demo medical registration",
    subtitle: "Renewal falls due once a year",
    body: "Placeholder entry shown only in demo mode. Nothing here has been checked with the issuing body.",
    details: {
      category: "Registration",
      kind: "compliance",
      consequence: "stops-work",
      expiresOn: demoDateKey(52),
      leadTimeDays: 60,
      issuingBody: "Ahpra",
      provenance: "confirmed",
      evidenceUrl: "https://example.org/demo-registration-receipt",
    },
    linkedDocumentIds: [],
    tags: ["Registration"],
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(81),
    section: "logistics",
    slug: "demo-medical-indemnity",
    title: "Demo medical indemnity cover",
    subtitle: "Policy runs a year at a time",
    body: null,
    details: {
      category: "Indemnity",
      kind: "compliance",
      consequence: "stops-work",
      expiresOn: demoDateKey(126),
      issuingBody: "Demo indemnity insurer",
      provenance: "read-from-certificate",
      evidenceUrl: "https://example.org/demo-indemnity-certificate",
    },
    linkedDocumentIds: [],
    tags: ["Indemnity"],
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 1,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(82),
    section: "logistics",
    slug: "demo-credentialing-scope-of-practice",
    title: "Demo credentialing and scope of practice",
    subtitle: "Reviewed by the demo credentialing committee",
    body: null,
    details: {
      category: "Credentialing",
      kind: "compliance",
      consequence: "stops-part",
      expiresOn: demoDateKey(240),
      leadTimeDays: 90,
      issuingBody: "Demo Health Service credentialing committee",
      provenance: "typed",
    },
    linkedDocumentIds: [],
    tags: ["Credentialing"],
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 2,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(83),
    section: "logistics",
    slug: "demo-working-with-children-check",
    title: "Demo Working with Children Check",
    subtitle: "Renewed every three years",
    body: null,
    details: {
      category: "Clearances",
      kind: "compliance",
      consequence: "stops-part",
      expiresOn: demoDateKey(310),
      leadTimeDays: 120,
      issuingBody: "Department of Communities (WA)",
      provenance: "read-from-certificate",
    },
    linkedDocumentIds: [],
    tags: ["Screening"],
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 3,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(84),
    section: "logistics",
    slug: "demo-basic-life-support-module",
    title: "Demo basic life support module",
    subtitle: "Online module and a practical session",
    // The one already past its recorded date, so the lapsed treatment appears
    // in a browser rather than only in a test.
    body: null,
    details: {
      category: "Training",
      kind: "compliance",
      consequence: "chased",
      expiresOn: demoDateKey(-12),
      leadTimeDays: 14,
      issuingBody: "Demo Health Service",
      provenance: "typed",
    },
    linkedDocumentIds: [],
    tags: ["Training"],
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 4,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(85),
    section: "logistics",
    slug: "demo-fire-and-evacuation-module",
    title: "Demo fire and evacuation module",
    subtitle: "Half an hour, online",
    body: null,
    details: {
      category: "Training",
      kind: "compliance",
      consequence: "chased",
      expiresOn: demoDateKey(21),
      leadTimeDays: 7,
      issuingBody: "Demo Health Service",
      provenance: "typed",
    },
    linkedDocumentIds: [],
    tags: ["Training"],
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 5,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(86),
    section: "logistics",
    slug: "demo-cpd-annual-return",
    title: "Demo CPD annual return",
    subtitle: "Through the college CPD home",
    body: null,
    details: {
      category: "CPD",
      kind: "compliance",
      consequence: "chased",
      expiresOn: demoDateKey(95),
      leadTimeDays: 30,
      issuingBody: "RANZCP",
      provenance: "typed",
    },
    linkedDocumentIds: [],
    tags: ["CPD"],
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 6,
    lastVerifiedAt: VERIFIED_RECENTLY,
  }),
  entry({
    id: id(87),
    section: "logistics",
    slug: "demo-national-police-clearance",
    title: "Demo national police clearance",
    subtitle: "Months, not weeks, to come back",
    // No `consequence`: the one row that lands in the page's "no consequence
    // recorded" band. Unknown is not the same as harmless, and the band exists
    // so a reader can see which rows nobody has thought through yet.
    body: null,
    details: {
      category: "Clearances",
      kind: "compliance",
      expiresOn: demoDateKey(400),
      leadTimeDays: 150,
      issuingBody: "Demo screening provider",
      provenance: "typed",
    },
    linkedDocumentIds: [],
    tags: ["Screening"],
    isPersonal: true,
    includeOnCard: false,
    sortOrder: 7,
    lastVerifiedAt: NEVER_VERIFIED,
  }),
];
