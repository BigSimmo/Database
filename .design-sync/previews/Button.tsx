import { Button } from "prompt-for-codex-medical-knowledge-base";
import { Download, Plus, Trash2 } from "lucide-react";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button variant="primary" icon={Plus}>
      Add source
    </Button>
    <Button variant="secondary">Review later</Button>
    <Button variant="toolbar" icon={Download}>
      Export
    </Button>
    <Button variant="ghost">Cancel</Button>
    <Button variant="danger" icon={Trash2}>
      Delete source
    </Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button variant="primary" size="sm">
      Small
    </Button>
    <Button variant="primary" size="md">
      Medium
    </Button>
    <Button variant="primary" size="lg">
      Large
    </Button>
  </div>
);

export const Busy = () => (
  <Button variant="primary" busy busyLabel="Reindexing source…">
    Reindex source
  </Button>
);

export const Disabled = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button variant="primary" disabled>
      Add source
    </Button>
    <Button variant="danger" disabled>
      Delete source
    </Button>
  </div>
);

export const Block = () => (
  <div className="w-72">
    <Button variant="primary" block>
      Confirm upload
    </Button>
  </div>
);
