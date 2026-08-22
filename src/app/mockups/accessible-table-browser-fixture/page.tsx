import { AccessibleTable } from "@/components/AccessibleTable";

// An interleaved unnamed clinical column is the conservative normalizer's
// `ambiguous_generic_column` case: it preserves the raw grid and marks it
// low-confidence instead of guessing which dose belongs to which action.
const columns = ["ANC level", "", "Action"];
const rows = [
  ["1.5", "", "Continue clozapine and monitor according to the local protocol"],
  ["1.0", "", "Withhold dose and seek specialist advice"],
];

export default function AccessibleTableBrowserFixturePage() {
  return (
    <main
      data-testid="accessible-table-browser-fixture"
      className="mx-auto min-h-screen w-full max-w-lg bg-[color:var(--background)] px-3 py-6 text-[color:var(--text)]"
    >
      <h1 className="text-lg font-semibold text-[color:var(--text-heading)]">Accessible table browser fixture</h1>
      <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
        Low-confidence clinical extraction with an explicitly missing dose value.
      </p>
      <section className="mt-4 min-w-0" aria-label="Low-confidence table example">
        <AccessibleTable caption="Clozapine ANC response" columns={columns} rows={rows} densePreview expandOnMobile />
      </section>
    </main>
  );
}
