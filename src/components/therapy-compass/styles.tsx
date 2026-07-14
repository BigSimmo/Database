"use client";

/**
 * Scoped helper + print styles for the Therapy Compass mockup.
 *
 * The design export shipped a global `<style>` block; we scope the interactive
 * helpers under `.tc-root` so they never leak to the rest of the app, and keep
 * a print rule that reveals only the patient-sheet "paper" (hiding the app
 * chrome, the tool rail and the builder controls). Because this `<style>` is
 * rendered by the Therapy Compass component, it is only present in the DOM on
 * the `/mockups/therapy-compass` route.
 */
const CSS = `
.tc-root .tc-scroll { scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; }
.tc-root .tc-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
.tc-root .tc-scroll::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 8px; border: 3px solid transparent; background-clip: content-box; }
.tc-root .tc-btn { transition: background .15s ease, border-color .15s ease, color .15s ease, box-shadow .15s ease, transform .05s ease; cursor: pointer; font-family: inherit; }
.tc-root .tc-btn:active { transform: translateY(0.5px); }
.tc-root .tc-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.tc-root .tc-row { transition: background .12s ease; }
.tc-root .tc-row:hover { background: var(--surface-subtle); }
@media (max-width: 640px) {
  .tc-root .tc-main { padding: 20px 16px 32px !important; }
}
@media print {
  @page { size: A4 portrait; margin: 14mm; }
  body { background: #fff !important; }
  body * { visibility: hidden !important; }
  .tc-paper, .tc-paper * { visibility: visible !important; }
  .tc-paper {
    position: absolute !important;
    left: 0; top: 0;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    border: none !important;
    box-shadow: none !important;
  }
  .tc-no-print { display: none !important; }
}
`;

export function TherapyCompassStyles() {
  return <style>{CSS}</style>;
}
