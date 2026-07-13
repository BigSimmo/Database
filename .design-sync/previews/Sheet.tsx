import type { ReactNode } from "react";
import { Sheet } from "prompt-for-codex-medical-knowledge-base";

/* Sheet renders position:fixed; the transform on this wrapper makes it the
 * containing block so the overlay stays inside the preview card. */
const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ transform: "translateZ(0)", position: "relative", height: 560, overflow: "hidden", borderRadius: 12 }}>
    {children}
  </div>
);

export const OpenDialog = () => (
  <Frame>
    <Sheet
      open
      onClose={() => {}}
      title="Filter documents"
      description="Narrow the library by status and jurisdiction."
    >
      <div style={{ display: "grid", gap: "0.75rem", padding: "0.25rem 0" }}>
        <label className="text-sm font-semibold">Status</label>
        <select className="h-11 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-sm">
          <option>Current</option>
          <option>Review due</option>
          <option>Outdated</option>
        </select>
      </div>
    </Sheet>
  </Frame>
);

export const WithFooter = () => (
  <Frame>
    <Sheet
      open
      onClose={() => {}}
      title="Delete document?"
      description="This removes the document and its index entries."
      footer={
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-4 text-sm font-semibold">
            Cancel
          </button>
          <button className="inline-flex min-h-tap items-center rounded-lg bg-[color:var(--danger-solid)] px-4 text-sm font-semibold text-[color:var(--danger-solid-contrast)]">
            Delete
          </button>
        </div>
      }
    >
      <p className="text-sm text-[color:var(--text-muted)]">Sepsis pathway v3.2.pdf — 18 indexed chunks.</p>
    </Sheet>
  </Frame>
);
