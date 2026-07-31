import { ToastProvider, ToastRegion, useToast, Button } from "prompt-for-codex-medical-knowledge-base";

// The region is fixed to the viewport, so stories stage it inside a sized,
// transformed container the same way Sheet does.
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative h-[18rem] w-[26rem] overflow-hidden rounded-lg border border-[color:var(--border)] p-4"
      style={{ transform: "translateZ(0)" }}
    >
      {children}
    </div>
  );
}

function Trigger() {
  const { push } = useToast();
  return (
    <Button
      variant="primary"
      onClick={() => push({ tone: "success", title: "Source indexed", body: "12 pages, 48 chunks." })}
    >
      Announce outcome
    </Button>
  );
}

export const Interactive = () => (
  <Stage>
    <ToastProvider>
      <Trigger />
    </ToastProvider>
  </Stage>
);

export const Tones = () => (
  <Stage>
    <div className="pointer-events-none space-y-2">
      <ToastRegion />
    </div>
    <p className="text-xs text-[color:var(--text-muted)]">
      Outcomes announce through role=status / aria-live=polite: important, but never interrupting what is being read.
    </p>
  </Stage>
);
