import type { DateSpan } from "@/lib/roster/ask/dates";
import { readDates } from "@/lib/roster/ask/dates";
import { ASK_STOP_WORDS, askWords, hasUnknownWords } from "@/lib/roster/ask/vocabulary";
import { perthDateOf } from "@/lib/roster/shifts/perth-time";

export type AskAssignment = {
  readonly id: string;
  readonly userId: string | null;
  readonly name: string | null;
  readonly grade: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly kind: string;
  readonly shiftCode: string;
};
export type AskPerson = { readonly userId: string; readonly name: string; readonly grade: string | null };
export type AskContext = {
  readonly today: string;
  readonly actorId: string | null;
  readonly assignments: readonly AskAssignment[];
  readonly people: readonly AskPerson[];
  readonly codes: readonly string[];
  readonly selectedDate?: DateSpan;
  readonly selectedUserId?: string;
};

export type AskQuestion =
  | {
      readonly kind:
        "next_nights" | "next_weekend_off" | "next_day_off" | "hours_fortnight" | "next_leave" | "rotation_end";
    }
  | { readonly kind: "on_date" | "with_me"; readonly span: DateSpan }
  | { readonly kind: "who_on"; readonly date: string; readonly grade?: string };
export type AskIntent =
  | { readonly kind: "give_away" | "cant_make"; readonly assignmentId: string }
  | { readonly kind: "swap"; readonly assignmentId: string; readonly withUserId?: string }
  | { readonly kind: "dates"; readonly from: string; readonly to: string; readonly dateKind: "cant" | "prefer_off" }
  | { readonly kind: "leave"; readonly from: string; readonly to: string };
export type AskChoice = { readonly label: string; readonly date?: DateSpan; readonly userId?: string };
export type AskResult =
  | { readonly kind: "question"; readonly q: AskQuestion }
  | { readonly kind: "change"; readonly intent: AskIntent }
  | { readonly kind: "clarify"; readonly ask: string; readonly options: readonly AskChoice[] }
  | { readonly kind: "not_understood" };

function personMatches(text: string, people: readonly AskPerson[]): AskPerson[] {
  const words = askWords(text);
  const afterWith = words.indexOf("with");
  if (afterWith < 0) return [];
  const nameWords = words.slice(afterWith + 1);
  const full = people.filter((person) => {
    const parts = askWords(person.name);
    return parts.length > 0 && parts.every((part, index) => nameWords[index] === part);
  });
  if (full.length) return full;
  return people.filter((person) => askWords(person.name)[0] === nameWords[0]);
}

function matchingOwnShift(ctx: AskContext, span: DateSpan, text: string): AskAssignment[] {
  const kinds = ["night", "evening", "day", "on_call"].filter((kind) =>
    new RegExp(`\\b${kind.replace("_", "[ -]?")}s?\\b`, "i").test(text),
  );
  return ctx.assignments.filter(
    (assignment) =>
      assignment.userId === ctx.actorId &&
      perthDateOf(assignment.startsAt) >= span.from &&
      perthDateOf(assignment.startsAt) <= span.to &&
      (kinds.length === 0 || kinds.includes(assignment.kind) || kinds.includes(assignment.shiftCode.toLowerCase())),
  );
}

/** A strict, finite grammar. It never sends text or issues a write. */
export function parseAsk(text: string, ctx: AskContext): AskResult {
  const beforeReason = text.split(/\bbecause\b/i)[0]?.trim() ?? "";
  const normalized = beforeReason.toLowerCase().replace(/[’']/g, "");
  const words = askWords(beforeReason);
  const blocked = ASK_STOP_WORDS.find((word) => words.includes(word));
  if (blocked)
    return { kind: "clarify", ask: `Roster can't read '${blocked}' yet. Tap the shifts instead.`, options: [] };
  if (
    !beforeReason ||
    hasUnknownWords(beforeReason, [
      ...ctx.codes,
      ...ctx.people.map((person) => person.name),
      ...ctx.assignments.map((assignment) => assignment.name ?? ""),
    ])
  )
    return { kind: "not_understood" };

  const dateRead = ctx.selectedDate ? ({ dates: [ctx.selectedDate] } as const) : readDates(beforeReason, ctx.today);
  if ("blocked" in dateRead)
    return {
      kind: "clarify",
      ask:
        dateRead.blocked === "past" ? "That date has passed." : "That weekday doesn't match the date. Please check it.",
      options: [],
    };
  if ("options" in dateRead)
    return {
      kind: "clarify",
      ask: dateRead.ask,
      options: dateRead.options.map((date) => ({ label: date.from, date })),
    };
  const span = dateRead.dates[0];
  const isSwap = /\b(swap|switch)\b/.test(normalized);
  const isGiveAway = /\bgive\s+away\b|\bcant\s+do\b/.test(normalized);
  const isCantMake = /\bcant\s+make\b/.test(normalized);
  const isDates = /\b(cant\s+work|prefer\s+off|dates\s+off|unavailable)\b/.test(normalized);
  const isLeave = /\b(annual|pd)\s+leave\b|\brequest\s+leave\b/.test(normalized);

  if (isSwap || isGiveAway || isCantMake || isDates || isLeave) {
    if (!span) return { kind: "clarify", ask: "Which date do you mean?", options: [] };
    if (isLeave) return { kind: "change", intent: { kind: "leave", from: span.from, to: span.to } };
    if (isDates || (span.from !== span.to && !isSwap))
      return {
        kind: "change",
        intent: {
          kind: "dates",
          from: span.from,
          to: span.to,
          dateKind: normalized.includes("prefer") ? "prefer_off" : "cant",
        },
      };
    if (!ctx.actorId)
      return {
        kind: "clarify",
        ask: "Your team identity is unavailable. Open the request sheet instead.",
        options: [],
      };
    const shifts = matchingOwnShift(ctx, span, normalized);
    if (shifts.length !== 1)
      return {
        kind: "clarify",
        ask: shifts.length
          ? "Which of your shifts? Tap it in Shifts."
          : "No matching team shift of yours is loaded. Tap the shift in Shifts.",
        options: [],
      };
    if (isSwap) {
      const people = personMatches(normalized, ctx.people);
      if (normalized.includes(" with ") && !ctx.selectedUserId && people.length !== 1) {
        return {
          kind: "clarify",
          ask: people.length ? "Which person?" : "That person isn't in the loaded team list.",
          options: people.map((person) => {
            const parts = person.name.split(/\s+/);
            return {
              label: `${parts[0]?.[0] ?? "?"}. ${parts.slice(1).join(" ")}, ${person.grade ?? "grade unknown"}`,
              userId: person.userId,
            };
          }),
        };
      }
      const withUserId = ctx.selectedUserId ?? people[0]?.userId;
      return {
        kind: "change",
        intent: { kind: "swap", assignmentId: shifts[0]!.id, ...(withUserId ? { withUserId } : {}) },
      };
    }
    return { kind: "change", intent: { kind: isCantMake ? "cant_make" : "give_away", assignmentId: shifts[0]!.id } };
  }

  if (/\bnext\s+nights?\b/.test(normalized)) return { kind: "question", q: { kind: "next_nights" } };
  if (/\bnext\s+weekend\s+off\b/.test(normalized)) return { kind: "question", q: { kind: "next_weekend_off" } };
  if (/\bnext\s+day\s+off\b/.test(normalized)) return { kind: "question", q: { kind: "next_day_off" } };
  if (/\b(hours|fortnight)\b/.test(normalized)) return { kind: "question", q: { kind: "hours_fortnight" } };
  if (/\bnext\s+leave\b/.test(normalized)) return { kind: "question", q: { kind: "next_leave" } };
  if (/\brotation\s+ends?\b/.test(normalized)) return { kind: "question", q: { kind: "rotation_end" } };
  if (/\bwhos?\b/.test(normalized) && span) {
    const grade = /\b(reg|registrar|resident|intern|fellow|consultant)\b/.exec(normalized)?.[1];
    return {
      kind: "question",
      q: { kind: "who_on", date: span.from, ...(grade ? { grade: grade === "reg" ? "registrar" : grade } : {}) },
    };
  }
  if (/\bwith\s+me\b/.test(normalized) && span) return { kind: "question", q: { kind: "with_me", span } };
  if (span && /\b(am|on|work|working|rostered)\b/.test(normalized))
    return { kind: "question", q: { kind: "on_date", span } };
  return { kind: "not_understood" };
}
