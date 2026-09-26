// Static shapes (standard §7), with the real crisis strip.
import { CrisisStrip } from "@/components/first-nations/crisis";

export function FirstNationsLoading() {
  return (
    <div className="mx-auto grid w-full max-w-[40rem] gap-3 px-3 pt-3">
      <span role="status" className="sr-only">
        Loading
      </span>
      <div aria-hidden="true" className="h-44 rounded-2xl bg-[color:var(--surface-subtle)]" />
      <CrisisStrip />
      <div aria-hidden="true" className="h-12 rounded-xl bg-[color:var(--surface-subtle)]" />
      <div aria-hidden="true" className="h-72 rounded-xl bg-[color:var(--surface-subtle)]" />
    </div>
  );
}
