"use client";

import { parseSafeBoldText } from "@/lib/safe-bold";

export function SafeBoldText({ text }: { text: string }) {
  return (
    <>
      {parseSafeBoldText(text).map((segment, index) =>
        segment.bold ? (
          <strong key={`${segment.text}:${index}`} className="font-bold text-[color:var(--text-heading)]">
            {segment.text}
          </strong>
        ) : (
          <span key={`${segment.text}:${index}`}>{segment.text}</span>
        ),
      )}
    </>
  );
}
