"use client";
import { Clipboard } from "lucide-react";
import { useState } from "react";
import { FnButton } from "@/components/first-nations/kit";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";

/** Copies approved note wording. The blanks are filled in by the doctor, in their own notes; nothing is kept here. */
export function CopyNoteWording({ template }: { template: string }) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-sm-minus text-[color:var(--text)]">
        {template}
      </p>
      <FnButton
        icon={Clipboard}
        label="Copy wording"
        className="justify-self-start"
        onClick={() => {
          copyTextToClipboard(template).then(
            () => setNote("Copied. Fill in the blanks yourself."),
            () => setNote("Copying isn't available on this phone"),
          );
        }}
      />
      {note ? (
        <p role="status" className="text-sm-minus text-[color:var(--text-muted)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}
