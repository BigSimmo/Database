export function PdfPreviewLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="grid min-h-64 place-items-center bg-[color:var(--surface-inset)] p-5 text-center text-sm text-[color:var(--text-muted)] sm:min-h-72"
    >
      Loading PDF reader…
    </div>
  );
}
