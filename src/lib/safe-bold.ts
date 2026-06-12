export type SafeBoldSegment = {
  text: string;
  bold: boolean;
};

export function parseSafeBoldText(input: string): SafeBoldSegment[] {
  const segments: SafeBoldSegment[] = [];
  const pattern = /\*\*([^*]+(?:\*(?!\*)[^*]+)*)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input))) {
    const before = input.slice(cursor, match.index).replace(/\*\*/g, "");
    if (before) segments.push({ text: before, bold: false });
    if (match[1]) segments.push({ text: match[1], bold: true });
    cursor = match.index + match[0].length;
  }

  const after = input.slice(cursor).replace(/\*\*/g, "");
  if (after) segments.push({ text: after, bold: false });

  return segments.length ? segments : [{ text: input.replace(/\*\*/g, ""), bold: false }];
}
