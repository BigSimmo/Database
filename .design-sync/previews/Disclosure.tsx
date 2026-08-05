import { Disclosure } from "prompt-for-codex-medical-knowledge-base";

export const Evidence = () => (
  <Disclosure title="Supporting evidence" meta="3 sources" description="Current and locally relevant" defaultOpen>
    <p className="text-sm">The evidence remains in document order and is available to print.</p>
  </Disclosure>
);
