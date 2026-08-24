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

const supportedMappingKeyPattern = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/u;
const quotedMappingKeyPattern = /^(?:"[^"]+"|'[^']+')\s*:/u;
const explicitMappingKeyPattern = /^[?:](?:\s|$)/u;
const unsupportedMappingKeyPattern = /^.*?:(?:\s|$)/u;
const yamlReferencePattern = /(?:^|[\s,[{])(?:&|\*)[A-Za-z0-9_-]+(?=$|[\s,\]}])/u;

export function yamlContractSyntaxFailures(source) {
  const failures = [];
  const frames = [{ indent: -1, keys: new Set() }];
  let blockScalarIndent = null;

  for (const [lineIndex, line] of source.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    if (blockScalarIndent !== null) {
      if (indent > blockScalarIndent) continue;
      blockScalarIndent = null;
    }

    while (frames.length > 1 && frames.at(-1).indent >= indent) frames.pop();
    let parent = frames.at(-1);
    let mappingText = trimmed;
    let mappingIndent = indent;
    if (mappingText.startsWith("- ")) {
      parent = { indent, keys: new Set() };
      frames.push(parent);
      mappingText = mappingText.slice(2).trimStart();
      mappingIndent = indent + 2;
    }

    if (quotedMappingKeyPattern.test(mappingText)) {
      failures.push(`unsupported quoted mapping key at line ${lineIndex + 1}`);
      continue;
    }
    if (explicitMappingKeyPattern.test(mappingText)) {
      failures.push(`unsupported explicit YAML mapping key syntax at line ${lineIndex + 1}`);
      continue;
    }
    if (/^<<\s*:/u.test(mappingText) || yamlReferencePattern.test(mappingText)) {
      failures.push(`anchors, aliases, and merge keys are unsupported at line ${lineIndex + 1}`);
      continue;
    }

    const mapping = supportedMappingKeyPattern.exec(mappingText);
    if (!mapping) {
      if (unsupportedMappingKeyPattern.test(mappingText)) {
        failures.push(`unsupported YAML mapping key at line ${lineIndex + 1}`);
      }
      continue;
    }
    const [, key, value = ""] = mapping;
    if (parent.keys.has(key)) {
      failures.push(`duplicate YAML mapping key ${key} at line ${lineIndex + 1}`);
    } else {
      parent.keys.add(key);
    }

    if (/^[>|][+-]?\d*$/u.test(value)) {
      blockScalarIndent = mappingIndent;
    } else if (value === "") {
      frames.push({ indent: mappingIndent, keys: new Set() });
    }
  }

  return [...new Set(failures)];
}

export function yamlMappingKeys(source, indent) {
  const pattern = new RegExp(`^ {${indent}}([A-Za-z0-9_-]+):(?:\\s|$)`);
  return source
    .split(/\r?\n/)
    .map((line) => pattern.exec(line)?.[1] ?? null)
    .filter(Boolean);
}

export function yamlScalar(source, key, indent) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^ {${indent}}${escapedKey}:\\s*([^#]*?)\\s*(?:#.*)?$`, "m");
  return pattern.exec(source)?.[1]?.trim() ?? null;
}

export function yamlSequenceItems(source, indent) {
  const pattern = new RegExp(`^ {${indent}}-\\s+(.+?)\\s*$`);
  return source
    .split(/\r?\n/)
    .map((line) => pattern.exec(line)?.[1] ?? null)
    .filter(Boolean);
}
