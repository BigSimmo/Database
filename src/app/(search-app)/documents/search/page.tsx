import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Document Search - Clinical KB",
  description: "Search indexed clinical documents and review matching evidence.",
};

export default function DocumentsSearchRoute() {
  return (
    <section className="mx-auto flex min-h-[55dvh] max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
        Indexed library
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-[color:var(--text-heading)]">Search clinical documents</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[color:var(--text-muted)]">
        Enter a query in the Documents composer to search the live indexed library. Results open the source document at
        the matching page and passage.
      </p>
    </section>
  );
}
