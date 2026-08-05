import { useState } from "react";
import { SegmentedControl } from "prompt-for-codex-medical-knowledge-base";

export const AnswerStyle = () => {
  const [value, setValue] = useState<"concise" | "detailed">("concise");
  return (
    <SegmentedControl
      label="Answer style"
      value={value}
      onChange={setValue}
      layout="equal"
      options={[
        { value: "concise", label: "Concise" },
        { value: "detailed", label: "Detailed" },
      ]}
    />
  );
};
