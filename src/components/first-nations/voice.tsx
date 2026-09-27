// The only users of the serif accent (Newsreader italic via .fn-voice): words to say aloud, quoted law, the Acknowledgement.
import { cn } from "@/components/ui-primitives";

const QUOTE_MARK = "text-[color:var(--mode-identity)]";

export function SpokenWords({ children, size = "lg" }: { children: string; size?: "lg" | "md" }) {
  return (
    <p
      data-mode-identity="first-nations"
      className={cn(
        "fn-voice border-l-[3px] border-[color:var(--mode-identity)] pl-3 text-[color:var(--text-heading)]",
        size === "lg" ? "text-lg-minus leading-snug" : "text-base-minus leading-snug",
      )}
    >
      <span aria-hidden="true" className={QUOTE_MARK}>
        “
      </span>
      {children}
      <span aria-hidden="true" className={QUOTE_MARK}>
        ”
      </span>
    </p>
  );
}

export function QuotedLaw({ children }: { children: string }) {
  return (
    <blockquote
      data-mode-identity="first-nations"
      className="fn-voice border-l-[3px] border-[color:var(--mode-identity)] pl-3 text-lg-minus leading-normal text-[color:var(--text-heading)]"
    >
      {children}
    </blockquote>
  );
}

export function AcknowledgementText({ children }: { children: string }) {
  return (
    <p data-fn-part="acknowledgement" className="fn-voice px-1 text-sm-minus text-[color:var(--text-muted)]">
      {children}
    </p>
  );
}
