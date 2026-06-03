export type SafeBoldSegment = {
  text: string;
  bold: boolean;
};

export function parseSafeBoldText(input: string): SafeBoldSegment[] {
  const segments: SafeBoldSegment[] = [];
  const parts = input.split("**");

  for (let index = 0; index < parts.length; index += 1) {
    const text = parts[index];
    if (!text) continue;
    segments.push({
      text,
      bold: index % 2 === 1,
    });
  }

  if (input.endsWith("**") || parts.length % 2 === 1) return segments;

  return [{ text: input, bold: false }];
}
