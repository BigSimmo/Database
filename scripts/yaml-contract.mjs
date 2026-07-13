export function yamlBlock(source, header, indent) {
  const lines = source.split(/\r?\n/);
  const prefix = `${" ".repeat(indent)}${header}`;
  const start = lines.findIndex((line) => line === prefix);
  if (start < 0) return "";
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const leading = line.length - line.trimStart().length;
    if (leading <= indent) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}
