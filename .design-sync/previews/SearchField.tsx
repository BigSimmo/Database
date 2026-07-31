import { SearchField } from "prompt-for-codex-medical-knowledge-base";

export const Empty = () => (
  <div className="w-80">
    <SearchField label="Search sources" placeholder="Search guidelines and protocols" />
  </div>
);

export const WithClear = () => (
  <div className="w-80">
    <SearchField label="Search sources" value="clozapine monitoring" onClear={() => {}} />
  </div>
);

export const VisibleLabel = () => (
  <div className="w-80">
    <SearchField label="Search sources" hideLabel={false} placeholder="Search guidelines and protocols" />
  </div>
);
