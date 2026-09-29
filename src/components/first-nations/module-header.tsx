import type { ReactNode } from "react";
import { FIRST_NATIONS_ICONS, type FirstNationsIconName } from "@/components/first-nations/first-nations-icons";
import { cn, eyebrowText } from "@/components/ui-primitives";

export function ModuleHeader({
  id,
  icon,
  title,
  action,
  inControl = false,
}: {
  id: string;
  icon: FirstNationsIconName;
  title: string;
  action?: ReactNode;
  /** Inside a tile that is itself a button: a heading is not allowed there, so the title is a span. */
  inControl?: boolean;
}) {
  const Icon = FIRST_NATIONS_ICONS[icon];
  const Title = inControl ? "span" : "h2";
  const Wrap = inControl ? "span" : "div";
  return (
    <Wrap className="flex min-h-12 items-center gap-2 px-3 pt-3">
      <span
        data-mode-identity="first-nations"
        className="grid size-7 shrink-0 place-items-center rounded-lg border border-[color:var(--mode-identity-border)] bg-[color:var(--mode-identity-soft)] text-[color:var(--mode-identity)]"
      >
        <Icon className="size-icon-md" aria-hidden="true" />
      </span>
      <Title id={id} className={cn(eyebrowText, "whitespace-nowrap")}>
        {title}
      </Title>
      {action ? <span className="ml-auto">{action}</span> : null}
    </Wrap>
  );
}

export function FnModule({
  id,
  icon,
  title,
  action,
  children,
  className,
}: {
  id: string;
  icon: FirstNationsIconName;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "grid min-w-0 gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] pb-3 shadow-[var(--e1)]",
        className,
      )}
    >
      <ModuleHeader id={id} icon={icon} title={title} action={action} />
      {children}
    </section>
  );
}
