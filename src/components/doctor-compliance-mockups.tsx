"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDashed,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  IdCard,
  Info,
  Lock,
  Paperclip,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { MockupPageShell, ModuleLabel, PhoneFrame, TopBar } from "@/components/on-call-shift-cover-mockups";

/**
 * Doctor compliance — a personal requirements tracker (2026-09-19).
 *
 * Design scratch, third of three. Nothing is wired; every date, number and
 * certificate in this file is invented, and no real registration, policy or
 * clearance number appears anywhere in it.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * The two ideas this study is arguing for, before any pixels
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **1. Sort by consequence, never by date.** Every compliance tracker ever
 * built is a list of thirty rows sorted by expiry. It goes amber, then red,
 * then ignored, because a fire-safety eLearning module and a lapsed medical
 * registration sit in the same visual bucket and only one of them stops you
 * working. So the spine of this design is three tiers that answer three
 * different questions:
 *
 *   - **Stops you working.** Registration, indemnity cover, credentialing.
 *   - **Stops part of your work.** Prescribing authorisations, Mental Health
 *     Act status, a clearance a particular role needs.
 *   - **You will be chased.** eLearning, immunisation records, appraisal.
 *
 * A row's tier is a property of the requirement, not of how close it is. That
 * is what makes the page readable when eleven things are amber at once.
 *
 * **2. It never says "compliant".** This is the line the whole feature turns
 * on. An app that renders a green tick beside "Medical registration" is making
 * an assertion about a person's legal standing from a date they typed in
 * themselves months ago. It cannot know about a condition on registration, a
 * notification, a payment that failed, or a certificate that was revoked.
 *
 * So every row is phrased as a record, not a verdict: *"you recorded this
 * expires on 30 Sep"*, with a link to the body that actually holds the answer.
 * The one place the word "verified" may appear is beside a date the reader
 * themselves confirmed against the register, with the date they did it —
 * which is the same freshness contract On Call already uses for phone numbers,
 * and for the same reason.
 *
 * Boards:
 *   A. Today — the answer line, the three tiers, the renewal horizon.
 *   B. One requirement, opened — who requires it, your record, the evidence.
 *   C. CPD — a progress instrument with per-category minimums, fed by the
 *      teaching attendance the On Call study already proposes logging.
 *   D. Evidence pack — the export that saves a weekend when credentialing.
 *   E. The year — where the renewals pile up, and what to move.
 *   F. Supervisor roll-up — status only, never the trainee's documents.
 */

/* ══════════════════════════  shared vocabulary  ══════════════════════════ */

/**
 * What happens if this lapses. The ONLY thing that decides a row's group.
 *
 * Deliberately not a severity scale. "critical / high / medium" invites the
 * question "high to whom?" and gets argued about; "you cannot work" is a fact
 * about the requirement that nobody has to interpret.
 */
type Consequence = "stops-work" | "stops-part" | "chased";

const CONSEQUENCE: Record<Consequence, { heading: string; blurb: string; icon: LucideIcon }> = {
  "stops-work": {
    heading: "Stops you working",
    blurb: "Without these you cannot practise at all.",
    icon: Ban,
  },
  "stops-part": {
    heading: "Stops part of your work",
    blurb: "You can still practise; specific things become unavailable.",
    icon: AlertTriangle,
  },
  chased: {
    heading: "You will be chased",
    blurb: "Administrative. Nobody is stopped, somebody will email.",
    icon: ClipboardCheck,
  },
};

/** How a stored date came to be what it is. Shown on every row, always. */
type Provenance = "confirmed" | "typed" | "read-from-certificate";

const PROVENANCE: Record<Provenance, string> = {
  confirmed: "you checked the register",
  typed: "you typed this",
  "read-from-certificate": "read off your certificate",
};

type Requirement = {
  name: string;
  /** The body that requires it — the answer to "do I actually have to?". */
  requiredBy: string;
  consequence: Consequence;
  icon: LucideIcon;
  /** How the reader described the deadline. Never computed into a verdict. */
  due: string;
  /** Days remaining, for the horizon strip and the lead-time comparison. */
  daysLeft: number;
  /** How long this one actually takes to renew — not a uniform 30 days. */
  leadTime: string;
  provenance: Provenance;
  evidence?: string;
  /** Only ever true when the reader ticked it themselves. */
  done?: boolean;
};

const REQUIREMENTS: Requirement[] = [
  {
    name: "Medical registration",
    requiredBy: "Ahpra",
    consequence: "stops-work",
    icon: IdCard,
    due: "30 September",
    daysLeft: 11,
    leadTime: "allow 6 weeks",
    provenance: "confirmed",
    evidence: "Registration certificate 2026.pdf",
  },
  {
    name: "Medical indemnity cover",
    requiredBy: "Your insurer",
    consequence: "stops-work",
    icon: ShieldCheck,
    due: "30 September",
    daysLeft: 11,
    leadTime: "allow 2 weeks",
    provenance: "read-from-certificate",
    evidence: "Certificate of currency.pdf",
  },
  {
    name: "Hospital credentialing",
    requiredBy: "Demo Hospital",
    consequence: "stops-work",
    icon: Building2,
    due: "14 March 2027",
    daysLeft: 176,
    leadTime: "allow 3 months",
    provenance: "typed",
  },
  {
    name: "Schedule 8 prescribing authorisation",
    requiredBy: "WA Department of Health",
    consequence: "stops-part",
    icon: FileText,
    due: "No expiry recorded",
    daysLeft: 999,
    leadTime: "—",
    provenance: "typed",
  },
  {
    name: "Working with Children Check",
    requiredBy: "State government",
    consequence: "stops-part",
    icon: Users,
    due: "2 December",
    daysLeft: 74,
    leadTime: "allow 8 weeks",
    provenance: "read-from-certificate",
    evidence: "WWCC card.jpg",
  },
  {
    name: "Basic life support",
    requiredBy: "Demo Hospital",
    consequence: "chased",
    icon: Stethoscope,
    due: "18 October",
    daysLeft: 29,
    leadTime: "allow 1 afternoon",
    provenance: "read-from-certificate",
    evidence: "BLS 2025.pdf",
  },
  {
    name: "Annual influenza vaccination",
    requiredBy: "Demo Hospital",
    consequence: "chased",
    icon: Syringe,
    due: "Recorded 3 April",
    daysLeft: 200,
    leadTime: "allow 20 minutes",
    provenance: "typed",
    done: true,
  },
  {
    name: "Fire and emergency eLearning",
    requiredBy: "Demo Hospital",
    consequence: "chased",
    icon: ClipboardCheck,
    due: "Overdue since 2 September",
    daysLeft: -17,
    leadTime: "allow 20 minutes",
    provenance: "typed",
  },
];

function Screen({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--background)] p-4">{children}</div>;
}

/**
 * The countdown, in words plus a shape.
 *
 * Amber and red never appear alone: each carries a word and a glyph, because
 * "status never by colour alone" is a design-system rule here and because a
 * printed or forced-colours copy of this page has to carry the same meaning.
 */
function DueChip({ requirement }: { requirement: Requirement }) {
  const { daysLeft, done } = requirement;
  if (done) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-[color:var(--success)] bg-[color:var(--success-soft)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--success-text)]">
        <Check aria-hidden="true" className="size-icon-xs" />
        Recorded
      </span>
    );
  }
  if (daysLeft < 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-[color:var(--danger)] bg-[color:var(--danger-soft)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--danger-text)]">
        <AlertTriangle aria-hidden="true" className="size-icon-xs" />
        {Math.abs(daysLeft)} days over
      </span>
    );
  }
  if (daysLeft <= 45) {
    return (
      <span className="nums inline-flex shrink-0 items-center gap-1 rounded-sm border border-[color:var(--warning)] bg-[color:var(--warning-soft)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--warning-text)]">
        <CalendarClock aria-hidden="true" className="size-icon-xs" />
        {daysLeft} days
      </span>
    );
  }
  return (
    <span className="nums inline-flex shrink-0 items-center gap-1 rounded-sm border border-[color:var(--border)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--text-muted)]">
      {daysLeft > 365 ? "No date" : `${daysLeft} days`}
    </span>
  );
}

function RequirementRow({ requirement }: { requirement: Requirement }) {
  const RowIcon = requirement.icon;
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5 shadow-[var(--e1)]">
      <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
        <RowIcon aria-hidden="true" className="size-icon-sm text-[color:var(--text-muted)]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 text-sm font-bold leading-5 text-[color:var(--text-heading)]">
            {requirement.name}
          </span>
          <DueChip requirement={requirement} />
        </span>
        <span className="block text-xs text-[color:var(--text-muted)]">
          {requirement.requiredBy} · {requirement.due}
        </span>
        {/* Provenance on every row, not in a detail view. A date nobody has
            checked since it was typed is the failure mode this whole feature
            has to design against, so it is never more than one line away. */}
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1 text-3xs text-[color:var(--text-soft)]">
            {requirement.provenance === "confirmed" ? (
              <BadgeCheck aria-hidden="true" className="size-icon-xs" />
            ) : (
              <CircleDashed aria-hidden="true" className="size-icon-xs" />
            )}
            {PROVENANCE[requirement.provenance]}
          </span>
          {requirement.evidence ? (
            <span className="inline-flex items-center gap-1 text-3xs text-[color:var(--text-soft)]">
              <Paperclip aria-hidden="true" className="size-icon-xs" />
              Evidence attached
            </span>
          ) : null}
        </span>
      </span>
    </div>
  );
}

function TierGroup({ tier }: { tier: Consequence }) {
  const meta = CONSEQUENCE[tier];
  const TierIcon = meta.icon;
  const rows = REQUIREMENTS.filter((requirement) => requirement.consequence === tier);
  return (
    <section className="mb-4">
      <div className="mb-1.5 flex items-start gap-2">
        <TierIcon aria-hidden="true" className="mt-0.5 size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
        <div className="min-w-0">
          <p className="text-2xs font-bold uppercase tracking-kicker text-[color:var(--text-heading)]">
            {meta.heading}
          </p>
          <p className="text-3xs leading-4 text-[color:var(--text-muted)]">{meta.blurb}</p>
        </div>
      </div>
      <div className="grid gap-1.5">
        {rows.map((requirement) => (
          <RequirementRow key={requirement.name} requirement={requirement} />
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════  board A — today  ═══════════════════════════ */

/**
 * The answer line.
 *
 * One sentence at the top, and it is the only thing on the page allowed to
 * summarise. Note what it does NOT say: not "you are compliant", not a
 * percentage, not a score. It counts what is close and names the nearest
 * thing, which is a statement about the reader's own records and cannot be
 * wrong about the world.
 *
 * The "nothing is close" version of this line matters just as much. A
 * compliance page that can never be calm is a page that gets closed.
 */
function AnswerLine() {
  return (
    <section className="mb-4 rounded-xl border border-[color:var(--warning)] bg-[color:var(--warning-soft)] p-3">
      <p className="text-sm font-bold leading-5 text-[color:var(--warning-text)]">
        Two things that stop you working are inside six weeks.
      </p>
      <p className="mt-1 text-xs leading-5 text-[color:var(--warning-text)]">
        Registration and indemnity both fall due on 30 September, and registration alone wants six weeks.
      </p>
      {/* `--command` rather than `--warning-text`. The warning token is a
          FOREGROUND role scoped for text on canvas, it has no paired
          contrast token, and it is not in the forced-colours remap block
          the way `--warning` is — so using it as a solid fill works today
          by coincidence rather than by contract. Every other solid control
          in these studies uses the command pair. */}
      <span className="mt-2 inline-flex min-h-tap items-center gap-1.5 rounded-sm bg-[color:var(--command)] px-3 text-xs font-bold text-[color:var(--command-contrast)]">
        Start the renewals
        <ChevronRight aria-hidden="true" className="size-icon-xs" />
      </span>
    </section>
  );
}

/**
 * The renewal horizon — twelve months as one strip.
 *
 * The single most useful thing this whole feature can show is not a date, it
 * is a CLUSTER. Registration, indemnity and the college CPD year all land
 * within a fortnight of each other, and nobody discovers that by reading a
 * list sorted by expiry — they discover it in the last week of September.
 * Three marks stacked over one month is the entire argument, visible without
 * reading a word.
 */
function HorizonStrip() {
  const months = ["O", "N", "D", "J", "F", "M", "A", "M", "J", "J", "A", "S"];
  // Marks per month, by index. September carries the pile-up.
  const marks: Record<number, number> = { 0: 1, 2: 1, 5: 1, 8: 1, 11: 3 };
  return (
    <section className="mb-4">
      <ModuleLabel action={<>Open the year</>}>Next 12 months</ModuleLabel>
      <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5">
        <div className="flex items-end gap-1">
          {months.map((month, index) => {
            const count = marks[index] ?? 0;
            return (
              <span key={`${month}-${index}`} className="grid min-w-0 flex-1 gap-1">
                <span className="grid w-full gap-0.5">
                  {Array.from({ length: 3 }, (_unused, slot) => (
                    <span
                      key={slot}
                      aria-hidden="true"
                      className={`block h-1.5 w-full rounded-pill ${
                        slot < count
                          ? count >= 3
                            ? "bg-[color:var(--warning)]"
                            : "bg-[color:var(--text-muted)]"
                          : "bg-[color:var(--surface-inset)]"
                      }`}
                    />
                  ))}
                </span>
                <span className="text-center text-3xs font-bold text-[color:var(--text-muted)]">{month}</span>
              </span>
            );
          })}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-3xs leading-4 text-[color:var(--text-muted)]">
          <Info aria-hidden="true" className="mt-px size-icon-xs shrink-0" />
          <span>Three renewals land in September. Two of them want six weeks, so the work starts in August.</span>
        </p>
      </div>
    </section>
  );
}

function BoardToday() {
  return (
    <PhoneFrame
      caption="A · Today — sorted by what happens if it lapses"
      note="Three tiers by consequence, not by date. One answer line at the top, and a horizon strip that shows the September pile-up without reading a word."
      heightClass="h-[1340px]"
    >
      <TopBar title="Requirements" mode="Compliance" icon={ShieldCheck} />
      <Screen>
        <AnswerLine />
        <HorizonStrip />
        <TierGroup tier="stops-work" />
        <TierGroup tier="stops-part" />
        <TierGroup tier="chased" />
        <p className="flex items-start gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5 text-2xs leading-4 text-[color:var(--text-muted)]">
          <Lock aria-hidden="true" className="mt-px size-icon-sm shrink-0" />
          <span>
            Everything on this page is private to you and never appears in search, on the pocket card, or to any other
            reader. It is your own record of your own dates — not a check of your standing with anybody.
          </span>
        </p>
      </Screen>
    </PhoneFrame>
  );
}

/* ═══════════════  board B — one requirement, opened  ═══════════════ */

/**
 * The detail view, and the sentence that keeps this feature honest.
 *
 * "PsychSift has not checked this with Ahpra and cannot" is not a disclaimer
 * bolted on at the end. It is the load-bearing statement of what the feature
 * is: a memory aid over dates the reader owns. Everything else on the card —
 * the confirm control, the date of the last confirmation, the link out to the
 * register — exists to make that sentence survivable rather than alarming.
 *
 * The confirm control reuses On Call's freshness contract exactly: a stamp
 * with a date, set only by a human action, and never inferred. The same idea
 * that keeps a year-old phone number off the printed card keeps a year-old
 * registration date from reading as current.
 */
function BoardRequirement() {
  return (
    <PhoneFrame
      caption="B · One requirement — a record, never a verdict"
      note="Who requires it, what you recorded, when you last checked with the body that actually knows, and where the paper is."
      heightClass="h-[880px]"
    >
      <TopBar title="Registration" mode="Compliance" icon={ShieldCheck} />
      <Screen>
        <div className="mb-3">
          <p className="text-2xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
            Stops you working
          </p>
          <p className="text-lg-minus font-bold leading-6 text-[color:var(--text-heading)]">Medical registration</p>
          <p className="text-xs text-[color:var(--text-muted)]">Required by Ahpra · specialist registration</p>
        </div>

        <div className="mb-3 grid gap-2 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--e2)]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
              You recorded
            </span>
            <span className="nums text-sm font-bold text-[color:var(--text-heading)]">Expires 30 Sep 2026</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
              Last checked
            </span>
            <span className="nums text-sm font-semibold text-[color:var(--text)]">2 Aug 2026 · by you</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
              Renewal takes
            </span>
            <span className="text-sm font-semibold text-[color:var(--text)]">About 6 weeks</span>
          </div>
        </div>

        {/* The honest sentence, in the middle of the card rather than in small
            print at the foot. */}
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5">
          <Info aria-hidden="true" className="mt-px size-icon-md shrink-0 text-[color:var(--text-muted)]" />
          <p className="text-2xs leading-4 text-[color:var(--text)]">
            <strong className="font-bold">This app has not checked this with Ahpra, and cannot.</strong> It holds the
            date you told it. The public register is the only record of your actual standing — conditions, notifications
            and suspensions never reach this page.
          </p>
        </div>

        <div className="mb-3 grid gap-1.5">
          <span className="flex min-h-tap items-center justify-between gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)]">
            Open the public register
            <ExternalLink aria-hidden="true" className="size-icon-sm" />
          </span>
          <span className="flex min-h-tap items-center justify-between gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text-heading)]">
            I have checked it — stamp today
            <BadgeCheck aria-hidden="true" className="size-icon-sm text-[color:var(--text-muted)]" />
          </span>
        </div>

        <ModuleLabel>Evidence</ModuleLabel>
        <div className="mb-3 flex min-h-tap items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3">
          <FileText aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">
              Registration certificate 2026.pdf
            </span>
            <span className="nums block text-3xs text-[color:var(--text-muted)]">
              Added 2 Aug · private to you · never indexed
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
        </div>

        <ModuleLabel>Remind me</ModuleLabel>
        {/* Lead time per requirement, not a uniform thirty days. A renewal that
            takes six weeks and an eLearning module that takes twenty minutes
            do not want the same warning, and giving them one is how a tracker
            teaches people to ignore it. */}
        <div className="flex gap-1.5">
          {["8 weeks", "6 weeks", "2 weeks"].map((option, index) => (
            <span
              key={option}
              className={`flex min-h-tap flex-1 items-center justify-center rounded-lg border text-xs font-bold ${
                index === 1
                  ? "border-[color:var(--text-heading)] bg-[color:var(--text-heading)] text-[color:var(--surface-raised)]"
                  : "border-[color:var(--border)] text-[color:var(--text-muted)]"
              }`}
            >
              {option}
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-3xs leading-4 text-[color:var(--text-muted)]">
          Set from how long this renewal actually takes, not a single site-wide default.
        </p>
      </Screen>
    </PhoneFrame>
  );
}

/* ═══════════════════════════  board C — CPD  ═══════════════════════════ */

/**
 * `fill` is a literal Tailwind width class rather than a computed percentage,
 * and that is a repo constraint rather than laziness: an interpolated width is
 * an inline `style`, and `check:design-drift-ratchet` counts those repo-wide
 * against a committed ceiling. Fixed scratch data, so a class per row costs
 * nothing; a real implementation would need a token or a considered exception.
 */
type CpdCategory = { name: string; done: number; minimum: number; note: string; fill: string };

const CPD: CpdCategory[] = [
  { name: "Educational activities", done: 21, minimum: 12.5, note: "Teaching, courses, reading", fill: "w-full" },
  { name: "Reviewing performance", done: 4, minimum: 5, note: "Peer review, multi-source feedback", fill: "w-4/5" },
  { name: "Measuring outcomes", done: 0, minimum: 5, note: "Audit, outcome data", fill: "w-0" },
];

/**
 * CPD as an instrument, not a total.
 *
 * The number everyone tracks — "34 of 50 hours" — is the least useful number
 * in the system, because the hours that are missing are never the hours you
 * are short of. A programme with per-category minimums fails on the small
 * categories while the total looks healthy: 21 hours of lectures does nothing
 * for a 5-hour audit requirement, and the flat total hides that until
 * December.
 *
 * So the total is a footnote and the CATEGORIES are the page, with the one
 * that is actually short called out in words above them.
 *
 * The second idea here is the cross-mode one, and it is the reason this
 * belongs in this app rather than in a spreadsheet: sessions ticked as
 * attended on the On Call teaching calendar already are CPD. Logging them
 * twice is how a log stops being kept. Anything imported says where it came
 * from and stays editable, because an automatic number nobody can correct is
 * worse than no number.
 */
function BoardCpd() {
  const total = CPD.reduce((sum, category) => sum + category.done, 0);
  return (
    <PhoneFrame
      caption="C · CPD — the category you are short of, not the total"
      note="Per-category minimums, because a healthy total hides the small category you fail on. Fed by teaching attendance so nothing is logged twice."
      heightClass="h-[880px]"
    >
      <TopBar title="CPD" mode="Compliance" icon={GraduationCap} />
      <Screen>
        <div className="mb-3 rounded-xl border border-[color:var(--warning)] bg-[color:var(--warning-soft)] p-3">
          <p className="text-sm font-bold leading-5 text-[color:var(--warning-text)]">
            Against the minimums you entered, one category is five hours short.
          </p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--warning-text)]">
            Measuring outcomes needs an audit or outcome data — not something you can do in the last fortnight. Check
            the figure against your programme: the app holds the number you typed, not the requirement.
          </p>
        </div>

        <ModuleLabel action={<>2026 year</>}>By category</ModuleLabel>
        <div className="mb-3 grid gap-2">
          {CPD.map((category) => {
            const short = category.done < category.minimum;
            return (
              <div
                key={category.name}
                className={`rounded-lg border p-2.5 ${
                  short
                    ? "border-[color:var(--warning)] bg-[color:var(--surface-raised)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface-raised)]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-5 text-[color:var(--text-heading)]">{category.name}</p>
                    <p className="text-3xs text-[color:var(--text-muted)]">{category.note}</p>
                  </div>
                  <span
                    className={`nums shrink-0 text-sm font-bold ${
                      short ? "text-[color:var(--warning-text)]" : "text-[color:var(--text-heading)]"
                    }`}
                  >
                    {category.done} / {category.minimum}
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className="mt-2 block h-1.5 overflow-hidden rounded-pill bg-[color:var(--surface-inset)]"
                >
                  <span
                    className={`block h-full rounded-pill ${category.fill} ${
                      short ? "bg-[color:var(--warning)]" : "bg-[color:var(--success)]"
                    }`}
                  />
                </span>
                {short ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-3xs font-bold text-[color:var(--warning-text)]">
                    <AlertTriangle aria-hidden="true" className="size-icon-xs" />
                    {(category.minimum - category.done).toFixed(1)} hours below the minimum you entered
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <ModuleLabel action={<>Add an activity</>}>Recently logged</ModuleLabel>
        <div className="mb-3 grid gap-1.5">
          {[
            ["Clozapine monitoring in practice", "1.0 h", "From teaching attendance — not yet counted"],
            ["Journal club", "1.0 h", "From teaching attendance — not yet counted"],
            ["Peer review group", "2.0 h", "You added and attested this"],
          ].map(([title, hours, source]) => (
            <div
              key={title}
              className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">{title}</span>
                <span className="block text-3xs text-[color:var(--text-muted)]">{source}</span>
              </span>
              <span className="nums shrink-0 text-sm font-bold text-[color:var(--text)]">{hours}</span>
            </div>
          ))}
        </div>

        <p className="nums mb-2 text-xs text-[color:var(--text-muted)]">
          {total} hours logged. CPD is your attestation to a regulator, so imported hours stay uncounted until you tick
          them — an hour the app added on your behalf is not an hour you have claimed.
        </p>
        <p className="flex items-start gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5 text-2xs leading-4 text-[color:var(--text-muted)]">
          <Info aria-hidden="true" className="mt-px size-icon-sm shrink-0" />
          <span>
            Category names and minimums are whatever you set them to, per programme and per year. This app does not ship
            a college&apos;s requirements as fact — they change, and a stale copy read as current is worse than no copy.
          </span>
        </p>
      </Screen>
    </PhoneFrame>
  );
}

/* ══════════════════  board D — the evidence pack  ══════════════════ */

/**
 * The export that is the actual reason to keep the records here.
 *
 * Every credentialing application, every new site, every locum agency asks for
 * the same bundle: registration, indemnity, BLS, immunisation record, WWCC. It
 * is the same weekend spent digging through email attachments, every time.
 *
 * One selectable pack, with a cover sheet that lists what is in it and what is
 * NOT — because a pack that silently omits an expired certificate is how
 * someone submits an incomplete application and finds out in three weeks. The
 * omission is on the cover sheet, named, with its date.
 *
 * The wallet card beside it is the small version of the same idea and follows
 * On Call's pocket card exactly: the numbers somebody asks you for at a desk,
 * on one card, with nothing on it that would matter if it were lost.
 */
function BoardEvidence() {
  return (
    <PhoneFrame
      caption="D · Evidence pack — the weekend this saves"
      note="One export for a credentialing application, with a cover sheet that names what is missing rather than quietly leaving it out."
      heightClass="h-[980px]"
    >
      <TopBar title="Evidence" mode="Compliance" icon={Paperclip} />
      <Screen>
        <div className="mb-3">
          <p className="text-lg-minus font-bold leading-6 text-[color:var(--text-heading)]">Build a pack</p>
          <p className="text-xs leading-5 text-[color:var(--text-muted)]">
            For a credentialing application, a new site, or a locum agency.
          </p>
        </div>

        <ModuleLabel action={<>Select all</>}>Include</ModuleLabel>
        <div className="mb-3 grid gap-1.5">
          {[
            ["Registration certificate", "Expires 30 Sep 2026", true, true],
            ["Certificate of currency", "Expires 30 Sep 2026", true, true],
            ["Basic life support", "Expires 18 Oct 2026", true, true],
            ["Immunisation record", "Updated 3 Apr 2026", true, true],
            ["Working with Children Check", "Expires 2 Dec 2026", true, true],
            ["Fire and emergency eLearning", "Overdue since 2 Sep", false, false],
          ].map(([label, meta, checked, hasFile]) => (
            <div
              key={String(label)}
              className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5"
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-sm border ${
                  checked
                    ? "border-[color:var(--command)] bg-[color:var(--command)] text-[color:var(--command-contrast)]"
                    : "border-[color:var(--border-strong)]"
                }`}
              >
                {checked ? <Check aria-hidden="true" className="size-icon-xs" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">{label}</span>
                <span className="nums block text-3xs text-[color:var(--text-muted)]">{meta}</span>
              </span>
              {hasFile ? (
                <Paperclip aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
              ) : (
                <span className="shrink-0 rounded-sm border border-[color:var(--danger)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--danger-text)]">
                  No file
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mb-3 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] p-2.5">
          <p className="text-2xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
            The cover sheet will say
          </p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text)]">
            Five documents enclosed, as recorded by the holder on 19 Sep 2026 and not verified by this app; each carries
            the date it was last confirmed and with whom. <strong className="font-bold">Not enclosed:</strong> fire and
            emergency eLearning, overdue since 2 September.
          </p>
        </div>

        <span className="mb-3 flex min-h-tap items-center justify-between gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)]">
          Export the pack
          <Download aria-hidden="true" className="size-icon-sm" />
        </span>

        <ModuleLabel>Wallet card</ModuleLabel>
        <div className="rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] p-2.5">
          <p className="text-3xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
            For the desk that asks
          </p>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {[
              ["Registration", "recorded 30 Sep 2026", "checked with the register 2 Aug"],
              ["Indemnity", "recorded 30 Sep 2026", "read off the certificate"],
              ["BLS", "recorded 18 Oct 2026", "read off the certificate"],
              ["WWCC", "recorded 2 Dec 2026", "read off the certificate"],
            ].map(([label, value, provenance]) => (
              <span key={label} className="min-w-0">
                <span className="block text-3xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
                  {label}
                </span>
                <span className="nums block text-2xs font-semibold leading-4 text-[color:var(--text-heading)]">
                  {value}
                </span>
                {/* Provenance travels with the export or the export becomes a
                    representation to a third party about someone's regulatory
                    standing. "Current to" was a verdict; "recorded" is not. */}
                <span className="block text-3xs leading-4 text-[color:var(--text-muted)]">{provenance}</span>
              </span>
            ))}
          </div>
          {/* No registration number, no policy number, no date of birth. A card
              designed to be lost harmlessly is a card you will actually carry. */}
          <p className="mt-2 border-t border-[color:var(--border)] pt-1.5 text-3xs leading-4 text-[color:var(--text-muted)]">
            As recorded by the holder, not verified by this app. Dates only — no registration number, policy number or
            date of birth, so losing it costs nothing.
          </p>
        </div>
      </Screen>
    </PhoneFrame>
  );
}

/* ═══════════════════════════  board E — the year  ═══════════════════════════ */

type YearRow = { month: string; items: Array<{ name: string; tier: Consequence }> };

const YEAR: YearRow[] = [
  {
    month: "September 2026",
    items: [
      { name: "Medical registration", tier: "stops-work" },
      { name: "Medical indemnity", tier: "stops-work" },
      { name: "CPD year closes", tier: "stops-part" },
    ],
  },
  { month: "October 2026", items: [{ name: "Basic life support", tier: "chased" }] },
  { month: "December 2026", items: [{ name: "Working with Children Check", tier: "stops-part" }] },
  { month: "March 2027", items: [{ name: "Hospital credentialing", tier: "stops-work" }] },
  { month: "April 2027", items: [{ name: "Influenza vaccination", tier: "chased" }] },
];

/**
 * The year, and the one action it offers.
 *
 * A calendar of renewals is only worth a screen if it can do something a list
 * cannot, and this is it: seeing three things land in one month, and being
 * able to MOVE one. Several renewals are movable — you can sit a BLS course
 * early, you can bring a credentialing submission forward — and spreading a
 * cluster is the only real defence against the month where everything is due
 * at once and one of them quietly does not get done.
 *
 * The suggestion is offered, never applied: "renew this early" changes a real
 * deadline in the real world, and an app that silently rewrites the date it is
 * tracking has stopped being a record of anything.
 */
function BoardYear() {
  return (
    <PhoneFrame
      caption="E · The year — see the pile-up, move one"
      note="The one thing a list cannot do: show three renewals landing in one month, and offer to spread them."
      heightClass="h-[860px]"
    >
      <TopBar title="The year" mode="Compliance" icon={CalendarClock} />
      <Screen>
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] p-2.5">
          <CalendarClock aria-hidden="true" className="mt-px size-icon-md shrink-0 text-[color:var(--text-muted)]" />
          <p className="text-xs leading-5 text-[color:var(--text)]">
            September carries three. Two of them cannot move. The third can — sit the BLS refresher in July and the
            month has one thing in it instead of three.
          </p>
        </div>

        <div className="grid gap-3">
          {YEAR.map((row) => {
            const crowded = row.items.length >= 3;
            return (
              <section key={row.month}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <p className="text-2xs font-bold uppercase tracking-kicker text-[color:var(--text-heading)]">
                    {row.month}
                  </p>
                  {crowded ? (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-[color:var(--warning)] bg-[color:var(--warning-soft)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--warning-text)]">
                      <AlertTriangle aria-hidden="true" className="size-icon-xs" />
                      Crowded
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-1.5">
                  {row.items.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5"
                    >
                      <span
                        aria-hidden="true"
                        className={`h-6 w-1 shrink-0 rounded-pill ${
                          item.tier === "stops-work"
                            ? "bg-[color:var(--danger)]"
                            : item.tier === "stops-part"
                              ? "bg-[color:var(--warning)]"
                              : "bg-[color:var(--border-strong)]"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">
                          {item.name}
                        </span>
                        {/* The tier in words beside the rule, so the colour is
                            never carrying the meaning on its own. */}
                        <span className="block text-3xs text-[color:var(--text-muted)]">
                          {CONSEQUENCE[item.tier].heading}
                        </span>
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-icon-sm shrink-0 text-[color:var(--text-muted)]"
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <span className="mt-3 flex min-h-tap items-center justify-between gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text-heading)]">
          Suggest a spread for September
          <ChevronRight aria-hidden="true" className="size-icon-sm text-[color:var(--text-muted)]" />
        </span>
        <p className="mt-1.5 text-3xs leading-4 text-[color:var(--text-muted)]">
          It proposes; it never moves a date for you. A real deadline changes only when you change it in the real world.
        </p>
      </Screen>
    </PhoneFrame>
  );
}

/* ═══════════════════  board F — the supervisor roll-up  ═══════════════════ */

/**
 * Supervising other people's compliance, without holding their documents.
 *
 * If this is ever used by a supervisor, the temptation is a table of trainees
 * with their certificates behind it, and that is the version that must not be
 * built. A supervisor's actual question is narrow — "is there anything I need
 * to chase before the term starts" — and it is answerable with three states
 * and no documents at all.
 *
 * So this board shows a status and a date and nothing else: no certificate, no
 * registration number, no immunisation detail, no reason for a gap. Each
 * trainee's own page stays theirs. The wording is deliberately about the
 * RECORD rather than the person — "nothing recorded" is a statement about this
 * app, not an accusation.
 *
 * This is the board most likely to be wrong for your service, and it is drawn
 * so the disagreement is easy: it is one screen, reading three states.
 */
function BoardSupervisor() {
  const trainees: Array<{ initials: string; role: string; state: "clear" | "soon" | "gap"; detail: string }> = [
    { initials: "B.E.", role: "Registrar · term 3", state: "clear", detail: "Nothing due before December" },
    { initials: "C.E.", role: "Registrar · term 3", state: "soon", detail: "One item inside 30 days" },
    { initials: "G.E.", role: "Resident · term 3", state: "gap", detail: "Two items with nothing recorded" },
  ];
  const STATE = {
    clear: {
      label: "Clear",
      className: "border-[color:var(--success)] bg-[color:var(--success-soft)] text-[color:var(--success-text)]",
      icon: Check,
    },
    soon: {
      label: "Due soon",
      className: "border-[color:var(--warning)] bg-[color:var(--warning-soft)] text-[color:var(--warning-text)]",
      icon: CalendarClock,
    },
    gap: {
      label: "Nothing recorded",
      className: "border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
      icon: CircleDashed,
    },
  } as const;
  return (
    <PhoneFrame
      caption="F · Supervisor roll-up — rejected, and kept to show why"
      note="Drawn as tightly as it can be drawn — three states, no documents — and still rejected on review. The tightest version of a bad idea is the useful thing to look at."
      heightClass="h-[700px]"
    >
      <TopBar title="My trainees" mode="Compliance" icon={Users} />
      <Screen>
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5">
          <Lock aria-hidden="true" className="mt-px size-icon-md shrink-0 text-[color:var(--text-muted)]" />
          <p className="text-2xs leading-4 text-[color:var(--text)]">
            <strong className="font-bold">You see a state and a date. Nothing else.</strong> No certificate, no
            registration number, no immunisation detail, no reason for a gap. Each person&apos;s own record stays
            theirs.
          </p>
        </div>

        <ModuleLabel action={<>Term 3</>}>Three people</ModuleLabel>
        <div className="grid gap-1.5">
          {trainees.map((trainee) => {
            const state = STATE[trainee.state];
            const StateIcon = state.icon;
            return (
              <div
                key={trainee.initials}
                className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-pill border border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
                  <span className="text-2xs font-bold text-[color:var(--text-muted)]">{trainee.initials}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[color:var(--text-heading)]">{trainee.role}</span>
                  <span className="block text-3xs text-[color:var(--text-muted)]">{trainee.detail}</span>
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-3xs font-bold ${state.className}`}
                >
                  <StateIcon aria-hidden="true" className="size-icon-xs" />
                  {state.label}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-3 rounded-lg border border-[color:var(--danger)] bg-[color:var(--danger-soft)] p-2.5 text-2xs leading-4 text-[color:var(--danger-text)]">
          <strong className="font-bold">The board most likely to be wrong for your service.</strong> Who may see whose
          compliance state is an employment question, not a product one. Drawn so it is easy to disagree with, and easy
          to leave out.
        </p>
      </Screen>
    </PhoneFrame>
  );
}

/* ══════════════════════════  the page  ══════════════════════════ */

export function DoctorComplianceMockups() {
  return (
    <MockupPageShell
      eyebrow="Compliance · study 3 of 3"
      title="What one doctor has to keep current"
      summary="A personal requirements tracker built on two rules. It sorts by what happens if something lapses — stops you working, stops part of your work, or somebody emails you — rather than by expiry date, because a list sorted by date puts a fire-safety module and a lapsed registration in the same bucket. And it never says 'compliant': every row is phrased as a record of a date you gave it, with a link to the body that actually holds the answer."
    >
      <div className="flex flex-wrap gap-x-6 gap-y-10">
        <BoardToday />
        <BoardRequirement />
        <BoardCpd />
        <BoardEvidence />
        <BoardYear />
        <BoardSupervisor />
      </div>
    </MockupPageShell>
  );
}
