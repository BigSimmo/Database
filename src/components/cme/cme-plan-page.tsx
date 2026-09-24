import { NotebookPen } from "lucide-react";
import Link from "next/link";

import { cn, EmptyState, primaryControl, textMuted } from "@/components/ui-primitives";

/**
 * The development plan — registered as a destination, not yet built.
 *
 * `Plan` is one of CME's six navigation destinations, so this route has to
 * exist: a registered destination with no route behind it is a link that 404s,
 * which is worse than a screen that says plainly what it does not do yet. The
 * plan itself is a real requirement (the national baseline requires one every
 * year, and writing it counts toward the hours), and the screen that captures
 * it is scheduled work rather than something this phase chose to skip.
 *
 * So this page states exactly that, and offers the one thing the owner CAN do
 * about the plan today: log the time spent writing it as an activity, which is
 * how the hours reach the year either way.
 *
 * A Server Component with no state, and no `CmeNavHeader`: it has no sections
 * to jump between, so adding the header would draw a rail over a single block
 * of text. When the real screen lands it will have sections, and `cmeSections`
 * is where they get declared.
 */
export function CmePlanPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold text-[color:var(--text)]">Development plan</h1>
      <p className={cn(textMuted, "mt-1 text-sm")}>
        Required every year, and worth hours in its own right — you write it once, near the start of the year, and check
        it as you go.
      </p>

      <div className="mt-6">
        <EmptyState
          testId="cme-plan-not-built"
          icon={NotebookPen}
          title="Writing your plan here is not built yet."
          body="Nothing about your plan is stored in this app at the moment, so keep it wherever you keep it now. The hours you spend writing it still count, and you can record them as an activity today."
        />
      </div>

      <div className="mt-6">
        <Link
          href={`/cme/new?title=${encodeURIComponent("Writing my professional development plan")}`}
          className={cn(primaryControl, "w-full")}
        >
          Log the time you spent on it
        </Link>
      </div>

      <p className={cn(textMuted, "mt-4 text-sm")}>
        Once your plan is written, record the date you finished it on{" "}
        <Link
          href="/cme/setup#cme-setup-steps"
          className="inline-flex min-h-tap items-center font-semibold text-[color:var(--clinical-accent)]"
        >
          the setup page
        </Link>{" "}
        so the dashboard counts it as done.
      </p>
    </main>
  );
}
