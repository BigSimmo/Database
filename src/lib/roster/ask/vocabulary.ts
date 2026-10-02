/** The finite words Ask Roster can safely interpret. Unknown words never disappear silently. */
export const ASK_STOP_WORDS = ["except", "not", "but", "only", "unless", "instead"] as const;

const WORDS = new Set(
  `
  a am an and are at away be can cannot cant change could do does dont for from give
  have hours how i in is it leave make me my next of off on or our roster request
  saturday sunday monday tuesday wednesday thursday friday sat sun mon tue tues wed thu thur
  thurs fri shift shifts night nights day days evening evenings call work working who whos
  when which where what with swap switch the this that to tomorrow today week weekend weekends
  fortnight pay rotation end ends annual pd prefer dates unavailable reg registrar resident
  intern fellow consultant other person planned approved applied longer until through till
  jan january feb february mar march apr april may jun june jul july aug august sep sept
  september oct october nov november dec december st nd rd th next its there will scheduled
  rostered any everyone covering colleague please mark sick cannot oncall
`
    .trim()
    .split(/\s+/),
);

export function askWords(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[’']/g, "")
      .match(/[a-z]+|\d+/g) ?? []
  );
}

export function hasUnknownWords(text: string, extraWords: readonly string[] = []): boolean {
  const known = new Set([...WORDS, ...extraWords.flatMap(askWords)]);
  return askWords(text).some((word) => !known.has(word) && !/^\d+$/.test(word));
}
