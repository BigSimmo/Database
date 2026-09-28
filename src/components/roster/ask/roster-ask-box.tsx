"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { RosterAskAnswer } from "@/components/roster/ask/roster-ask-answer";
import { useRosterAskContext } from "@/components/roster/ask/use-roster-ask-context";
import { modeControlShape, modeModuleSurface, modeTapArea } from "@/components/mode-kit/recipes";
import { answerQuestion } from "@/lib/roster/ask/answer";
import { askIntentHref } from "@/lib/roster/ask/handoff";
import { parseAsk, type AskChoice, type AskContext, type AskResult } from "@/lib/roster/ask/parse";
import { formatPerthDay, perthDateOf } from "@/lib/roster/shifts/perth-time";

const SUGGESTIONS = ["When am I next on nights?", "Am I on 14 Dec?", "Who's the reg Saturday?"] as const;

function readingFor(result: AskResult, ctx: AskContext): string | null {
  if (result.kind !== "change") return null;
  const intent = result.intent;
  if (intent.kind === "dates")
    return `${intent.dateKind === "prefer_off" ? "Prefer off" : "Can't work"} ${formatPerthDay(intent.from)}${intent.to === intent.from ? "" : `–${formatPerthDay(intent.to)}`}`;
  if (intent.kind === "leave")
    return `Request leave ${formatPerthDay(intent.from)}${intent.to === intent.from ? "" : `–${formatPerthDay(intent.to)}`}`;
  const shift = ctx.assignments.find((item) => item.id === intent.assignmentId);
  const detail = shift
    ? `${formatPerthDay(perthDateOf(shift.startsAt))} ${shift.kind.replace("_", " ")}`
    : "your shift";
  if (intent.kind === "swap") return `Swap ${detail}`;
  return `${intent.kind === "give_away" ? "Give away" : "Can't make"} ${detail}`;
}

type Pending = { readonly id: number; readonly text: string };

function RosterAskSession({
  pending,
  onNavigate,
}: {
  readonly pending: Pending | null;
  readonly onNavigate: () => void;
}) {
  const router = useRouter();
  const { parser, answers, teamChoices, selectedTeamId, selectTeam, loading } = useRosterAskContext();
  const [selection, setSelection] = useState<{ id: number; teamId: string | null; choice: AskChoice } | null>(null);
  const chosen =
    pending && selection?.id === pending.id && selection.teamId === selectedTeamId ? selection.choice : null;
  const ctx = {
    ...parser,
    ...(chosen?.date ? { selectedDate: chosen.date } : {}),
    ...(chosen?.userId ? { selectedUserId: chosen.userId } : {}),
  };
  const result = pending && !loading ? parseAsk(pending.text, ctx) : null;
  const answer = result?.kind === "question" ? answerQuestion(result.q, answers) : null;
  const reading = result ? readingFor(result, ctx) : null;

  function choose(choice: AskChoice) {
    if (!pending) return;
    setSelection({ id: pending.id, teamId: selectedTeamId, choice });
  }

  function open() {
    if (result?.kind !== "change") return;
    const href = askIntentHref(result.intent, selectedTeamId);
    onNavigate();
    router.push(href);
  }

  return (
    <>
      {teamChoices.length > 1 ? (
        <label className="grid gap-1 px-3 text-sm text-[color:var(--text-muted)]">
          Team roster
          <select
            value={selectedTeamId ?? ""}
            onChange={(event) => {
              selectTeam(event.target.value);
              setSelection(null);
            }}
            className="min-h-12 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-[color:var(--text)]"
          >
            {teamChoices.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {pending && /\bbecause\b/i.test(pending.text) ? (
        <p className="px-3 text-sm text-[color:var(--text-muted)]">Reasons aren&apos;t saved.</p>
      ) : null}
      {result ? (
        <RosterAskAnswer result={result} answer={answer} reading={reading} onChoice={choose} onOpen={open} />
      ) : null}
    </>
  );
}

/** In-flow local grammar. Roster reads begin only after a question is submitted. */
export function RosterAskBox() {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [active, setActive] = useState(false);
  const nextId = useRef(0);

  function submit(value: string) {
    nextId.current += 1;
    setPending({ id: nextId.current, text: value });
    setActive(true);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(text);
  }

  return (
    <section aria-label="Ask Roster" className="grid gap-3">
      <form onSubmit={onSubmit} className={`${modeModuleSurface} flex min-w-0 items-center gap-2 p-2`}>
        <input
          type="text"
          aria-label="Ask or change your roster"
          placeholder="Ask or change your roster"
          autoComplete="off"
          enterKeyHint="search"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setPending(null);
          }}
          className="min-h-12 min-w-0 flex-1 rounded-md bg-transparent px-2 text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-muted)] focus-visible:outline-2 focus-visible:outline-[color:var(--command)]"
        />
        <button type="submit" aria-label="Read roster question" className={modeTapArea}>
          <span className={modeControlShape.command}>
            <Search aria-hidden="true" className="size-4" />
          </span>
        </button>
      </form>
      {!text && !pending ? (
        <div className="flex flex-wrap gap-2 px-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setText(suggestion);
                submit(suggestion);
              }}
              className="min-h-12 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-sm text-[color:var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--command)]"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      {active ? (
        <RosterAskSession
          pending={pending}
          onNavigate={() => {
            setText("");
            setPending(null);
            setActive(false);
          }}
        />
      ) : null}
    </section>
  );
}
