/**
 * F2: a plain stand-in for the shared mode kit, shaped to the kit's real props
 * (src/components/mode-kit/), so First Nations tests do not depend on kit markup.
 * `src/components/first-nations/kit.ts` is the one import point it replaces; if
 * the kit's props change, change this file and `kit.ts` together.
 *
 * First Nations' own parts that `kit.ts` also re-exports (the live status and
 * the labelled button, both candidates to move into the kit) are the real
 * components here, because their behaviour is what the tests check.
 */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatDayMonthYear } from "@/lib/first-nations/contact-format";

export { FnButton } from "@/components/first-nations/fn-button";
export { FnLiveStatus } from "@/components/first-nations/live-status";

export const modeNameText = "kit-name";
export const modeNumberText = "kit-number";

type DialNumber = { display: string; tel: string | null; copy?: string | null };
type Source = { label: string; url: string };

const checkedLine = (source: Source | null | undefined, checkedAt: string | null | undefined, verb = "Checked") =>
  [source ? `From ${source.label}` : null, checkedAt ? `${verb} ${formatDayMonthYear(checkedAt)}` : null]
    .filter(Boolean)
    .join(" · ");

export function ModeGroupedList({ eyebrow, children }: { eyebrow?: string; mode?: string; children: ReactNode }) {
  return (
    <section data-kit="grouped-list">
      {eyebrow ? <h2>{eyebrow}</h2> : null}
      <ul>{children}</ul>
    </section>
  );
}
export function ModeRow({
  title,
  subtitle,
  trailing,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <li data-kit="row">
      <span>{title}</span>
      {subtitle ? <span>{subtitle}</span> : null}
      {trailing}
    </li>
  );
}
export function ModeFactTiles({ children }: { children: ReactNode }) {
  return <div data-kit="fact-tiles">{children}</div>;
}
export function ModeFactTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div data-kit="fact-tile">
      <span>{label}</span> {value}
    </div>
  );
}
export function ModeNotice({ tone = "neutral", children }: { tone?: string; children: ReactNode }) {
  return (
    <div role="note" data-tone={tone}>
      {children}
    </div>
  );
}
export function ModeStateLabel({ tone = "muted", children }: { tone?: string; children: ReactNode }) {
  return <span data-state={tone}>{children}</span>;
}
export function ModeUpdatedLine({
  updatedAt,
  verb = "Updated",
  sources,
}: {
  updatedAt: string | null;
  verb?: "Updated" | "Checked";
  sources?: readonly Source[];
}) {
  return <p>{checkedLine(sources?.[0], updatedAt, verb)}</p>;
}
export function ModeActionButton({
  label,
  href,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return href ? (
    <a href={href} aria-label={label} />
  ) : (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} />
  );
}
export function ModeModuleSkeleton() {
  return <div data-kit="skeleton" />;
}
export function ModeDialRow({
  label,
  subtitle,
  number,
}: {
  label: string;
  subtitle?: string;
  number: DialNumber | null;
  source?: Source | null;
  checkedAt?: string | null;
  testId: string;
}) {
  return (
    <li data-kit="dial-row">
      <span>{label}</span> <span>{number?.display ?? "Not recorded"}</span> {subtitle}
    </li>
  );
}
export function ModeDialSheet({
  open,
  label,
  context,
  number,
  source,
  checkedAt,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  context?: string | null;
  number: DialNumber;
  source?: Source | null;
  checkedAt?: string | null;
  testId?: string;
}) {
  return open ? (
    <div role="dialog" aria-label={label} data-tel={number.tel ?? ""} data-copy={number.copy ?? number.display}>
      {context ? <p>{context}</p> : null}
      <span>{number.display}</span>
      <p>{checkedLine(source, checkedAt)}</p>
    </div>
  ) : null;
}
