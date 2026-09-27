// Server-safe, no hooks, never lazy-loaded.
import { Phone } from "lucide-react";
import { cn } from "@/components/ui-primitives";
import { WA_CRISIS_CONTACTS, type PublicCrisisContact } from "@/lib/crisis-contacts";

const EMERGENCY = "SYN-CRISIS-CONTACT-001";
const YARN = "SYN-CRISIS-CONTACT-007";
const MHERL_METRO = "SYN-CRISIS-CONTACT-002";
const LIFELINE = "SYN-CRISIS-CONTACT-005";
const SHORT: Record<string, string> = {
  [EMERGENCY]: "Emergency",
  [YARN]: "13YARN, 24 h",
  [MHERL_METRO]: "Mental Health Emergency Response Line",
  [LIFELINE]: "Lifeline",
};

function pick(ids: readonly string[]): PublicCrisisContact[] {
  return ids.map((id) => {
    const found = WA_CRISIS_CONTACTS.find((c) => c.id === id);
    if (!found) throw new Error(`Missing crisis contact ${id}`);
    return found;
  });
}

/** 000 and 13YARN, one tap to dial. The rem-based basis wraps to one per row at 200 % text. */
export function CrisisStrip() {
  return (
    <nav aria-label="Crisis numbers" data-fn-part="crisis" className="flex flex-wrap gap-2">
      {pick([EMERGENCY, YARN]).map((c) => {
        const emergency = c.id === EMERGENCY;
        return (
          <a
            key={c.id}
            href={`tel:${c.telephoneUri}`}
            className={cn(
              "flex min-h-[3.25rem] min-w-[9.5rem] flex-1 items-center gap-2.5 rounded-xl border px-3",
              emergency
                ? "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-text)]"
                : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-heading)] shadow-[var(--e1)]",
            )}
          >
            <Phone className="size-icon-md shrink-0" aria-hidden="true" />
            <span className="grid min-w-0 leading-tight">
              <span className="nums text-lg-minus font-normal">{c.telephoneDisplay}</span>
              <span className="text-2xs">{SHORT[c.id]}</span>
            </span>
          </a>
        );
      })}
    </nav>
  );
}

export function CrisisBlock() {
  return (
    <section aria-labelledby="fn-crisis" className="grid gap-2">
      <h2
        id="fn-crisis"
        className="px-1 text-2xs font-semibold uppercase tracking-label text-[color:var(--text-muted)]"
      >
        Crisis
      </h2>
      <ul className="grid rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--e1)]">
        {pick([EMERGENCY, YARN, MHERL_METRO, LIFELINE]).map((c) => (
          <li key={c.id} className="border-t border-[color:var(--border)] first:border-t-0">
            <a
              href={`tel:${c.telephoneUri}`}
              className="flex min-h-12 flex-wrap items-baseline justify-between gap-x-3 px-3 py-2"
            >
              <span className="text-base-minus font-medium text-[color:var(--text-heading)]">{SHORT[c.id]}</span>
              <span
                className={cn(
                  "nums text-base-minus font-normal",
                  c.id === EMERGENCY ? "text-[color:var(--danger-text)]" : "text-[color:var(--text)]",
                )}
              >
                {c.telephoneDisplay}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
