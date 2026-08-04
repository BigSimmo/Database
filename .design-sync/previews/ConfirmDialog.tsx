import { ConfirmDialog } from "prompt-for-codex-medical-knowledge-base";

// ConfirmDialog renders through Sheet (position: fixed), so each story is wrapped
// in an explicitly-sized, transformed container to keep the overlay inside the card.
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative h-[26rem] w-[24rem] overflow-hidden rounded-lg border border-[color:var(--border)]"
      style={{ transform: "translateZ(0)" }}
    >
      {children}
    </div>
  );
}

export const Destructive = () => (
  <Stage>
    <ConfirmDialog
      open
      onCancel={() => {}}
      onConfirm={() => {}}
      title="Delete this source?"
      description="The document, its extracted pages and every citation pointing at it are removed. This cannot be undone."
      confirmLabel="Delete source"
    />
  </Stage>
);

export const TypedConfirmation = () => (
  <Stage>
    <ConfirmDialog
      open
      onCancel={() => {}}
      onConfirm={() => {}}
      title="Retire approved guideline?"
      description="Retiring removes this guideline from every future answer. Existing answers keep their citation."
      confirmLabel="Retire guideline"
      confirmPhrase="RETIRE"
    />
  </Stage>
);

export const NonDestructive = () => (
  <Stage>
    <ConfirmDialog
      open
      tone="primary"
      onCancel={() => {}}
      onConfirm={() => {}}
      title="Reindex this source?"
      description="Reindexing re-runs extraction and embedding. The current index stays live until the new one commits."
      confirmLabel="Reindex"
    />
  </Stage>
);
