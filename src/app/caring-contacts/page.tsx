import dynamic from "next/dynamic";

/**
 * The workspace's lazy route boundary (Ruling 13), present from its first commit.
 *
 * The Clinical KB dashboard must never download this workspace's client code.
 * Two things hold that: the workspace is imported by nothing outside this route
 * segment — the tools catalogue names it by href, not by import — and the shell
 * is loaded here through `next/dynamic`. Next 16's lazy-loading guide is
 * explicit that dynamically importing a Server Component lazy-loads the Client
 * Components underneath it, which is the only client payload the workspace has.
 * Later screens land behind this same boundary rather than beside it.
 */
const CaringContactsShell = dynamic(() =>
  import("@/components/caring-contacts/workspace/shell").then((module) => module.CaringContactsShell),
);

export default function CaringContactsTodayPage() {
  return (
    <CaringContactsShell
      title="Today"
      description="The day's caring-contact work for this team. Every patient, number and message in this workspace is invented; nothing here is ever sent to a real number."
    >
      <section aria-labelledby="caring-contacts-today-intro" className="min-w-0">
        <h2 id="caring-contacts-today-intro" className="text-base font-semibold text-[color:var(--text-heading)]">
          What this screen will show
        </h2>
        <p className="mt-2 max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
          The contacts due today, the ones that did not go out, and the patients whose plans need a decision. The
          workspace is being built one screen at a time; the More destinations panel lists what is still to come and
          what each destination will hold.
        </p>
      </section>
    </CaringContactsShell>
  );
}
