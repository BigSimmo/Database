"use client";

import { parseSafeBoldText } from "@/lib/safe-bold";

export type SafeBoldTextProps = { text: string };

export function SafeBoldText({ text }: SafeBoldTextProps) {
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
