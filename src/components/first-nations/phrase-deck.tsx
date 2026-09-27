"use client";
import { ArrowRight, Clipboard } from "lucide-react";
import { useState } from "react";
import { ModeActionButton, ModeUpdatedLine } from "@/components/first-nations/kit";
import { FnModule } from "@/components/first-nations/module-header";
import { SpokenWords } from "@/components/first-nations/voice";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import type { PhraseView } from "@/lib/first-nations/view-model";

export function PhraseDeck({ id, phrases }: { id: string; phrases: readonly PhraseView[] }) {
  const [i, setI] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const phrase = phrases[i];
  return (
    <FnModule
      id={id}
      icon="message"
      title="Phrases"
      action={
        <span className="flex items-center gap-1 text-2xs text-[color:var(--text-muted)]">
          <span className="nums">{`${i + 1} of ${phrases.length}`}</span>
          <ModeActionButton
            icon={ArrowRight}
            label="Next phrase"
            onClick={() => {
              setI((n) => (n + 1) % phrases.length);
              setNote(null);
            }}
          />
        </span>
      }
    >
      <div className="grid gap-2 px-3">
        <SpokenWords>{phrase.say}</SpokenWords>
        <div className="flex items-center justify-end">
          <ModeActionButton
            icon={Clipboard}
            label="Copy phrase"
            onClick={() => {
              copyTextToClipboard(phrase.say).then(
                () => setNote("Copied"),
                () => setNote("Copying isn't available on this phone"),
              );
            }}
          />
        </div>
        {note ? (
          <p role="status" className="text-sm-minus text-[color:var(--text-muted)]">
            {note}
          </p>
        ) : null}
        <ModeUpdatedLine
          updatedAt={phrase.checkedAt}
          verb="Checked"
          sources={[{ label: phrase.source.title, url: phrase.source.url }]}
        />
      </div>
    </FnModule>
  );
}
