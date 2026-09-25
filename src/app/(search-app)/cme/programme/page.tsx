import type { Metadata } from "next";
import Link from "next/link";

import { CmeProgrammePage } from "@/components/cme/cme-programme-page";
import { CmeStateNotice } from "@/components/cme/cme-state-notice";
import { EmptyState } from "@/components/ui-primitives";
import { loadCmePageData } from "@/lib/cme/load-cme-page-data";

export const metadata: Metadata = {
  title: "Programme | CME | PsychSift",
  description: "The targets you confirmed for this year, and the document you confirmed them against.",
};

export default async function CmeProgrammeRoute({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const query = await searchParams;
  const requestedYear = query.year ? Number(query.year) : undefined;
  const data = await loadCmePageData(
    Number.isInteger(requestedYear) && requestedYear! >= 2000 && requestedYear! <= 2100 ? requestedYear : undefined,
  );
  if (data.state === "signed-out" || data.state === "unavailable") {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <CmeStateNotice state={data.state} year={data.year} />
      </main>
    );
  }
  if (!data.set) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <EmptyState
          testId="cme-programme-unconfirmed"
          title="Confirm this year's targets first."
          body="The programme screen shows the numbers you confirmed against a stated document. Nothing is shown here until that confirmation exists."
          actions={
            <Link
              href="/cme/setup"
              className="inline-flex min-h-tap items-center justify-center rounded-lg bg-[color:var(--command)] px-5 text-sm font-semibold text-[color:var(--command-contrast)]"
            >
              Go to set up
            </Link>
          }
        />
      </main>
    );
  }
  return <CmeProgrammePage set={data.set} />;
}
