import { Tabs } from "prompt-for-codex-medical-knowledge-base";
import { BookOpen, FileText, Stethoscope } from "lucide-react";

const items = [
  { id: "answer", label: "Answer", icon: Stethoscope },
  { id: "sources", label: "Sources", icon: FileText, count: 6 },
  { id: "guidance", label: "Guidance", icon: BookOpen },
  { id: "audit", label: "Audit", disabled: true },
];

export const Underlined = () => (
  <div className="w-[32rem]">
    <Tabs label="Answer sections" items={items} value="answer" onChange={() => {}} />
  </div>
);

export const Segmented = () => (
  <div className="w-[32rem]">
    <Tabs label="Answer sections" variant="segmented" items={items} value="sources" onChange={() => {}} />
  </div>
);

export const WithPanel = () => (
  <div className="w-[32rem]">
    <Tabs label="Answer sections" items={items} value="sources" onChange={() => {}}>
      <p className="text-sm text-[color:var(--text-muted)]">Six sources support this answer.</p>
    </Tabs>
  </div>
);
