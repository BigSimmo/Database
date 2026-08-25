import { ChoiceChip } from "prompt-for-codex-medical-knowledge-base";

export const States = () => (
  <div className="flex flex-wrap items-center gap-2">
    <ChoiceChip pressed={false} onPressedChange={() => {}}>
      Penicillin
    </ChoiceChip>
    <ChoiceChip pressed onPressedChange={() => {}}>
      Sulfa
    </ChoiceChip>
    <ChoiceChip pressed={false} ariaDisabled onPressedChange={() => {}}>
      Unavailable
    </ChoiceChip>
  </div>
);

export const Compact = () => (
  <div className="flex flex-wrap items-center gap-2">
    <ChoiceChip size="compact" pressed onPressedChange={() => {}}>
      First line
    </ChoiceChip>
    <ChoiceChip size="compact" pressed={false} onPressedChange={() => {}}>
      Adjunct
    </ChoiceChip>
  </div>
);
