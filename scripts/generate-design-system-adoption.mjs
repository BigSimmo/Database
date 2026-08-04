import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import ts from "@typescript/typescript6";
import prettier from "prettier";

const ROOT = process.cwd();
const CONTRACT_PATH = "docs/design-system/adoption-contract.json";
const MANIFEST_PATH = "docs/design-system/adoption-manifest.json";
const CONFIG_PATH = ".design-sync/config.json";
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const TEXT_CACHE = new Map();
const SOURCE_FILE_CACHE = new Map();
const IMPORT_FACT_CACHE = new Map();

const toPosix = (value) => value.split(path.sep).join("/");
const read = (relativePath, root = ROOT) => {
  const key = `${root}:${relativePath}`;
  if (!TEXT_CACHE.has(key)) TEXT_CACHE.set(key, fs.readFileSync(path.join(root, relativePath), "utf8"));
  return TEXT_CACHE.get(key);
};
const exists = (relativePath, root = ROOT) => fs.existsSync(path.join(root, relativePath));

function walk(directory, root = ROOT) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute, root);
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) return [];
    const relative = toPosix(path.relative(root, absolute));
    return relative.includes("/mockups/") || relative.includes("-mockup") ? [] : [relative];
  });
}

export function productionPageRoutes(root = ROOT) {
  return walk(path.join(root, "src", "app"), root)
    .filter(
      (relativePath) =>
        /\/page\.(?:ts|tsx)$/.test(relativePath) &&
        !relativePath.includes("/api/") &&
        !relativePath.includes("/mockups/"),
    )
    .sort();
}

function sourceFile(relativePath, root = ROOT) {
  const key = `${root}:${relativePath}`;
  if (!SOURCE_FILE_CACHE.has(key))
    SOURCE_FILE_CACHE.set(
      key,
      ts.createSourceFile(relativePath, read(relativePath, root), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
    );
  return SOURCE_FILE_CACHE.get(key);
}

function exportedNames(relativePath, root = ROOT) {
  if (!exists(relativePath, root)) return [];
  const source = sourceFile(relativePath, root);
  const names = new Set();
  for (const statement of source.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const exported = modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (exported && "name" in statement && statement.name && ts.isIdentifier(statement.name))
      names.add(statement.name.text);
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) names.add(element.name.text);
    }
  }
  return [...names].sort();
}

function resolveImport(importer, specifier) {
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}${path.extname(specifier) ? "" : ".tsx"}`;
  if (!specifier.startsWith(".")) return null;
  const candidate = toPosix(path.normalize(path.join(path.dirname(importer), specifier)));
  return path.extname(candidate) ? candidate : `${candidate}.tsx`;
}

function importFacts(relativePath, sourceMap, root = ROOT) {
  if (!exists(relativePath, root)) return [];
  const cacheKey = `${root}:${relativePath}`;
  if (IMPORT_FACT_CACHE.has(cacheKey)) return IMPORT_FACT_CACHE.get(cacheKey);
  const source = sourceFile(relativePath, root);
  const facts = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const resolved = resolveImport(relativePath, statement.moduleSpecifier.text);
    const imported =
      statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)
        ? statement.importClause.namedBindings.elements.map((element) => element.name.text).sort()
        : [];
    for (const [component, componentSource] of Object.entries(sourceMap)) {
      const matchesSource = resolved === componentSource || resolved === componentSource.replace(/\.tsx$/, ".ts");
      if (matchesSource && (imported.length === 0 || imported.includes(component))) facts.push(component);
    }
  }
  const result = [...new Set(facts)].sort();
  IMPORT_FACT_CACHE.set(cacheKey, result);
  return result;
}

const UNKNOWN_CLASS_FRAGMENT = "\u0000";
const CLASS_NAME_HELPERS = new Set(["cn", "clsx", "classnames", "classNames", "cx", "cva", "twMerge"]);
const MAX_CLASS_PATTERNS = 64;
const SURFACE_PROOF_STATUSES = new Set(["passed", "pending", "unverified", "not-applicable"]);
const BASELINE_STATUSES = new Set(["committed", "not-committed", "not-applicable"]);

function classTokenPresent(value) {
  return value.split(/\s+/).includes("ckb-v2");
}

function couldConstructCkbV2(value) {
  if (!value.includes(UNKNOWN_CLASS_FRAGMENT)) return classTokenPresent(value);
  const staticText = value.replaceAll(UNKNOWN_CLASS_FRAGMENT, "").toLowerCase();
  if (!staticText.includes("ckb") && !staticText.includes("v2")) return false;
  const replacements = ["", "ckb-v2", "ckb-", "v2", "-", " ", " ckb-v2 "];
  let candidates = [value];
  while (candidates.some((candidate) => candidate.includes(UNKNOWN_CLASS_FRAGMENT))) {
    const next = [];
    for (const candidate of candidates) {
      const marker = candidate.indexOf(UNKNOWN_CLASS_FRAGMENT);
      if (marker < 0) {
        next.push(candidate);
        continue;
      }
      for (const replacement of replacements) {
        next.push(`${candidate.slice(0, marker)}${replacement}${candidate.slice(marker + 1)}`);
        if (next.length >= MAX_CLASS_PATTERNS) break;
      }
      if (next.length >= MAX_CLASS_PATTERNS) break;
    }
    candidates = next;
    if (candidates.length >= MAX_CLASS_PATTERNS) break;
  }
  return candidates.some(classTokenPresent);
}

function unwrapExpression(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    (ts.isSatisfiesExpression?.(current) ?? false)
  ) {
    current = current.expression;
  }
  return current;
}

function combineClassPatterns(groups, separator, constructed = false) {
  let combined = [{ value: "", constructed: false }];
  for (const group of groups) {
    const next = [];
    for (const left of combined) {
      for (const right of group) {
        next.push({
          value: left.value ? `${left.value}${separator}${right.value}` : right.value,
          constructed: constructed || left.constructed || right.constructed,
        });
        if (next.length >= MAX_CLASS_PATTERNS) break;
      }
      if (next.length >= MAX_CLASS_PATTERNS) break;
    }
    combined = next;
  }
  return combined;
}

/**
 * Parse only class-bearing expressions. A literal `ckb-v2` token is a normal
 * opt-in; any concatenation/template/join that can synthesize that token is a
 * dynamic opt-in and fails the adoption contract.
 */
export function analyzeCkbV2ClassUsage(relativePath, sourceText) {
  const source = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const bindings = [];
  const classExpressions = [];

  function propertyName(node) {
    if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
    return null;
  }

  function isFunctionScope(node) {
    return (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    );
  }

  function isLexicalScope(node) {
    return (
      ts.isSourceFile(node) ||
      ts.isBlock(node) ||
      ts.isModuleBlock(node) ||
      ts.isCaseBlock(node) ||
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node)
    );
  }

  function bindingScope(declaration) {
    if (ts.isParameter(declaration) && isFunctionScope(declaration.parent)) return declaration.parent;
    const declarationList = declaration.parent;
    const blockScoped =
      ts.isVariableDeclarationList(declarationList) && (declarationList.flags & ts.NodeFlags.BlockScoped) !== 0;
    let current = declarationList.parent;
    while (current) {
      if (blockScoped && isLexicalScope(current)) return current;
      if (!blockScoped && (isFunctionScope(current) || ts.isSourceFile(current))) return current;
      current = current.parent;
    }
    return source;
  }

  function isWithinScope(node, scope) {
    let current = node;
    while (current) {
      if (current === scope) return true;
      current = current.parent;
    }
    return false;
  }

  function scopeDepth(scope) {
    let depth = 0;
    let current = scope;
    while (current.parent) {
      depth += 1;
      current = current.parent;
    }
    return depth;
  }

  function collect(node) {
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) && ts.isIdentifier(node.name)) {
      const scope = bindingScope(node);
      bindings.push({ declaration: node, scope, depth: scopeDepth(scope) });
    }
    if (ts.isJsxAttribute(node) && ["class", "className"].includes(node.name.getText(source))) {
      if (node.initializer && ts.isStringLiteral(node.initializer)) classExpressions.push(node.initializer);
      if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression)
        classExpressions.push(node.initializer.expression);
    }
    if (ts.isPropertyAssignment(node) && ["class", "className"].includes(propertyName(node.name))) {
      classExpressions.push(node.initializer);
    }
    ts.forEachChild(node, collect);
  }
  collect(source);

  function resolveBinding(identifier) {
    const referencePosition = identifier.getStart(source);
    const visible = bindings
      .filter(
        (binding) => binding.declaration.name.text === identifier.text && isWithinScope(identifier, binding.scope),
      )
      .sort((left, right) => {
        if (left.depth !== right.depth) return right.depth - left.depth;
        const leftPosition = left.declaration.getStart(source);
        const rightPosition = right.declaration.getStart(source);
        const leftPrecedes = leftPosition <= referencePosition;
        const rightPrecedes = rightPosition <= referencePosition;
        if (leftPrecedes !== rightPrecedes) return leftPrecedes ? -1 : 1;
        return leftPrecedes ? rightPosition - leftPosition : leftPosition - rightPosition;
      });
    return visible[0] ?? null;
  }

  function arrayElements(expression, seen) {
    const current = unwrapExpression(expression);
    if (ts.isArrayLiteralExpression(current)) return [...current.elements];
    if (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression) &&
      current.expression.name.text === "filter"
    ) {
      return arrayElements(current.expression.expression, seen);
    }
    if (ts.isIdentifier(current)) {
      const binding = resolveBinding(current);
      if (binding?.declaration.initializer && !seen.has(binding.declaration)) {
        return arrayElements(binding.declaration.initializer, new Set(seen).add(binding.declaration));
      }
    }
    return null;
  }

  function unresolvedCallHasCkbV2Evidence(call) {
    const evidence = [];
    function collectEvidence(node) {
      if (ts.isStringLiteralLike(node) || ts.isIdentifier(node)) evidence.push(node.text.toLowerCase());
      ts.forEachChild(node, collectEvidence);
    }
    collectEvidence(call);
    const staticText = evidence.join(" ");
    return staticText.includes("ckb") && staticText.includes("v2");
  }

  function patternsFor(expression, seen = new Set()) {
    const current = unwrapExpression(expression);
    if (ts.isStringLiteralLike(current)) return [{ value: current.text, constructed: false }];
    if (ts.isNumericLiteral(current)) return [{ value: current.text, constructed: false }];
    if (current.kind === ts.SyntaxKind.TrueKeyword || current.kind === ts.SyntaxKind.FalseKeyword)
      return [{ value: "", constructed: false }];
    if (ts.isIdentifier(current)) {
      const binding = resolveBinding(current);
      if (!binding?.declaration.initializer || seen.has(binding.declaration))
        return [{ value: UNKNOWN_CLASS_FRAGMENT, constructed: false }];
      return patternsFor(binding.declaration.initializer, new Set(seen).add(binding.declaration));
    }
    if (ts.isTemplateExpression(current)) {
      let combined = [{ value: current.head.text, constructed: true }];
      for (const span of current.templateSpans) {
        combined = combineClassPatterns([combined, patternsFor(span.expression, seen)], "", true).map((entry) => ({
          value: `${entry.value}${span.literal.text}`,
          constructed: true,
        }));
      }
      return combined;
    }
    if (ts.isConditionalExpression(current)) {
      return [...patternsFor(current.whenTrue, seen), ...patternsFor(current.whenFalse, seen)].slice(
        0,
        MAX_CLASS_PATTERNS,
      );
    }
    if (ts.isBinaryExpression(current)) {
      if (current.operatorToken.kind === ts.SyntaxKind.PlusToken)
        return combineClassPatterns([patternsFor(current.left, seen), patternsFor(current.right, seen)], "", true);
      if (
        current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        current.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        current.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      ) {
        return [
          { value: "", constructed: false },
          ...patternsFor(current.left, seen),
          ...patternsFor(current.right, seen),
        ].slice(0, MAX_CLASS_PATTERNS);
      }
    }
    if (ts.isCallExpression(current)) {
      if (ts.isPropertyAccessExpression(current.expression) && current.expression.name.text === "replace") {
        const receivers = patternsFor(current.expression.expression, seen);
        const searches = current.arguments[0]
          ? patternsFor(current.arguments[0], seen)
          : [{ value: UNKNOWN_CLASS_FRAGMENT, constructed: false }];
        const replacements = current.arguments[1]
          ? patternsFor(current.arguments[1], seen)
          : [{ value: "undefined", constructed: false }];
        const results = [];
        for (const receiver of receivers) {
          for (const search of searches) {
            for (const replacement of replacements) {
              const resolvable = ![receiver.value, search.value, replacement.value].some((value) =>
                value.includes(UNKNOWN_CLASS_FRAGMENT),
              );
              results.push({
                value: resolvable
                  ? receiver.value.replace(search.value, replacement.value)
                  : unresolvedCallHasCkbV2Evidence(current)
                    ? "ckb-v2"
                    : UNKNOWN_CLASS_FRAGMENT,
                constructed: true,
              });
              if (results.length >= MAX_CLASS_PATTERNS) return results;
            }
          }
        }
        return results;
      }
      if (ts.isPropertyAccessExpression(current.expression) && current.expression.name.text === "join") {
        const elements = arrayElements(current.expression.expression, seen);
        if (elements) {
          const separators = current.arguments[0]
            ? patternsFor(current.arguments[0], seen)
            : [{ value: ",", constructed: false }];
          const results = [];
          for (const separator of separators) {
            results.push(
              ...combineClassPatterns(
                elements.map((element) => patternsFor(element, seen)),
                separator.value,
                true,
              ),
            );
            if (results.length >= MAX_CLASS_PATTERNS) break;
          }
          return results.slice(0, MAX_CLASS_PATTERNS);
        }
      }
      const helperName = ts.isIdentifier(current.expression)
        ? current.expression.text
        : ts.isPropertyAccessExpression(current.expression)
          ? current.expression.name.text
          : "";
      if (CLASS_NAME_HELPERS.has(helperName)) {
        return combineClassPatterns(
          current.arguments.map((argument) => patternsFor(argument, seen)),
          " ",
        );
      }
      return [
        {
          value: unresolvedCallHasCkbV2Evidence(current) ? "ckb-v2" : UNKNOWN_CLASS_FRAGMENT,
          constructed: unresolvedCallHasCkbV2Evidence(current),
        },
      ];
    }
    if (ts.isArrayLiteralExpression(current)) {
      return combineClassPatterns(
        current.elements.map((element) => patternsFor(element, seen)),
        " ",
      );
    }
    if (ts.isObjectLiteralExpression(current)) {
      const classKeys = current.properties.flatMap((property) => {
        if (ts.isPropertyAssignment(property)) {
          if (ts.isComputedPropertyName(property.name)) return patternsFor(property.name.expression, seen);
          const name = propertyName(property.name);
          return name ? [{ value: name, constructed: false }] : [];
        }
        if (ts.isShorthandPropertyAssignment(property)) return patternsFor(property.name, seen);
        return [];
      });
      return combineClassPatterns(classKeys, " ");
    }
    return [{ value: UNKNOWN_CLASS_FRAGMENT, constructed: false }];
  }

  let literalCkbV2 = false;
  let dynamicCkbV2 = false;
  for (const expression of classExpressions) {
    for (const pattern of patternsFor(expression)) {
      if (!pattern.constructed && classTokenPresent(pattern.value)) literalCkbV2 = true;
      if (pattern.constructed && couldConstructCkbV2(pattern.value)) dynamicCkbV2 = true;
    }
  }
  return { literalCkbV2, dynamicCkbV2 };
}

function manifestSections(manifest) {
  const componentRows = manifest.components.map(
    (component) =>
      `| \`${component.name}\` | ${component.family} | ${component.built ? "yes" : "no"} | ${component.locallyRegistered ? "yes" : "no"} | ${component.v2ShellMounted ? "yes" : "no"} | ${component.proofDeclared ? "yes" : "no"} | ${component.baselineCommitted ? "yes" : "no"} | ${component.productImportFiles.length} |`,
  );
  const maturity = [
    "<!-- adoption-manifest:maturity:start -->",
    "## Generated maturity snapshot",
    "",
    `Registered public components: ${manifest.summary.registeredComponentCount}`,
    `Components with a valid design-sync preview: ${manifest.summary.previewCount}`,
    `Components with product imports: ${manifest.summary.productImportedComponentCount}`,
    "",
    "This generated snapshot is a local source-derived inventory. It does not assert remote design-project publication.",
    "",
    "| Component | Family | Built | Locally registered | v2 shell mounted | Proof declared | Baseline committed | Product imports |",
    "| --- | --- | --- | --- | --- | --- | --- | ---: |",
    ...componentRows,
    "<!-- adoption-manifest:maturity:end -->",
  ].join("\n");
  const surfaceRows = manifest.surfaces.map((surface) => {
    const proofStatuses = [...new Set(Object.values(surface.proof).map((declaration) => declaration.status))];
    return `| \`${surface.id}\` | ${surface.disposition} | ${surface.routes.length} | ${surface.roots.length} | ${surface.shellState} | ${proofStatuses.join(", ")} | ${surface.baseline.status} |`;
  });
  const adoption = [
    "<!-- adoption-manifest:adoption:start -->",
    "## Generated adoption truth",
    "",
    "`generate-design-system-adoption.mjs` discovers every production `src/app/**/page.tsx` and",
    "requires each route to appear exactly once in `adoption-contract.json`. Undeclared, missing, or",
    "multiply-owned routes fail the check. `src/app/api/**` and `src/app/mockups/**` are non-page",
    "product exclusions; the only route-only disposition is the documented legacy document-source",
    "redirect. Shared shell/component roots carry their own explicit `shared-shell` disposition.",
    "",
    `Registered public components: ${manifest.summary.registeredComponentCount}`,
    `Declared product roots: ${manifest.summary.rootCount}`,
    `Roots with a literal \`.ckb-v2\` opt-in: ${manifest.adoption.literalCkbV2RootCount}`,
    `Dynamic \`ckb-v2\` constructions: ${manifest.adoption.dynamicCkbV2RootCount}`,
    `Declared production page routes: ${manifest.routeCoverage.declared.length}/${manifest.routeCoverage.discovered.length}`,
    "",
    "The live product remains on the compatibility layer until a declared root opts into the v2 class literally.",
    "The Proof column summarizes each surface's dark, forced-colours, 320px, print and browser declarations; exact statuses and evidence paths live in the manifest.",
    "A v2 shell declaration fails closed unless every proof is passed with evidence and its visual baseline is committed.",
    "",
    "| Surface | Disposition | Routes | Roots | Expected shell | Proof | Baseline |",
    "| --- | --- | ---: | ---: | --- | --- | --- |",
    ...surfaceRows,
    "<!-- adoption-manifest:adoption:end -->",
  ].join("\n");
  return { maturity, adoption };
}

function replaceMarkedSection(document, start, end, replacement) {
  const expression = new RegExp(`${start}[\\s\\S]*?${end}`);
  return expression.test(document)
    ? document.replace(expression, replacement)
    : `${document.trimEnd()}\n\n${replacement}\n`;
}

export function buildAdoptionManifest({ root = ROOT } = {}) {
  const contract = JSON.parse(read(CONTRACT_PATH, root));
  const config = JSON.parse(read(CONFIG_PATH, root));
  const sourceMap = config.componentSrcMap ?? {};
  const sourceFiles = walk(path.join(root, "src"), root);
  const testFiles = walk(path.join(root, "tests"), root);
  const entry = read(".design-sync/entry.tsx", root);
  const componentInventory = Object.keys(contract.componentFamilies)
    .sort()
    .map((name) => {
      const source = sourceMap[name] ?? null;
      const sourceExports = source ? exportedNames(source, root) : [];
      const productImportFiles = sourceFiles.filter((file) => importFacts(file, sourceMap, root).includes(name));
      const preview = `.design-sync/previews/${name}.tsx`;
      const previewValid =
        exists(preview, root) &&
        new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*["']${config.pkg}["']`).test(
          read(preview, root),
        );
      const testMatches = testFiles.filter((file) => new RegExp(`\\b${name}\\b`).test(read(file, root)));
      const entryExported = source
        ? (source === "src/components/ui-primitives.tsx" &&
            /export \* from ["']@\/components\/ui-primitives["']/.test(entry)) ||
          new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(entry)
        : false;
      return {
        name,
        family: contract.componentFamilies[name],
        source,
        sourceExported: sourceExports.includes(name),
        entryExported,
        productImportFiles,
        designSync: {
          listedInSourceMap: Boolean(source),
          listedInDtsProps: Object.hasOwn(config.dtsPropsFor ?? {}, name),
          preview,
          previewValid,
        },
        testFiles: testMatches,
        baseline: contract.baseline,
      };
    });
  const surfaces = contract.productionSurfaces.map((surface) => {
    const rootFiles = [...(surface.routeRoots ? surface.routes : []), ...(surface.roots ?? [])].filter(
      (rootFile, index, files) => files.indexOf(rootFile) === index,
    );
    const roots = rootFiles.map((rootFile) => {
      const sourceText = exists(rootFile, root) ? read(rootFile, root) : "";
      const imports = importFacts(rootFile, sourceMap, root);
      const importedFamilies = [...new Set(imports.map((name) => contract.componentFamilies[name]))].sort();
      const { literalCkbV2, dynamicCkbV2 } = analyzeCkbV2ClassUsage(rootFile, sourceText);
      return {
        file: rootFile,
        exists: Boolean(sourceText),
        imports,
        importedFamilies,
        literalCkbV2,
        dynamicCkbV2,
        sanctionedPatternsPresent: surface.sanctionedSpecialPatterns.filter((pattern) => sourceText.includes(pattern)),
      };
    });
    return {
      id: surface.id,
      disposition: surface.disposition,
      documentedDisposition: surface.documentedDisposition ?? null,
      routes: [...surface.routes].sort(),
      shellState: surface.expectedShellState,
      proof: Object.fromEntries(
        Object.entries(surface.proof ?? {}).sort(([left], [right]) => left.localeCompare(right)),
      ),
      baseline: surface.baseline
        ? { status: surface.baseline.status, files: [...(surface.baseline.files ?? [])].sort() }
        : null,
      permittedComponentFamilies: [...surface.permittedComponentFamilies].sort(),
      sanctionedSpecialPatterns: [...surface.sanctionedSpecialPatterns].sort(),
      roots,
    };
  });
  const components = componentInventory.map((component) => {
    const built = Boolean(component.source && component.sourceExported);
    const locallyRegistered = Boolean(
      component.entryExported &&
      component.designSync.listedInSourceMap &&
      component.designSync.listedInDtsProps &&
      component.designSync.previewValid,
    );
    const v2ShellMounted = surfaces.some(
      (surface) =>
        surface.shellState === "v2" &&
        surface.roots.some((rootFact) => rootFact.literalCkbV2 && rootFact.imports.includes(component.name)),
    );
    return {
      ...component,
      built,
      locallyRegistered,
      v2ShellMounted,
      proofDeclared: component.testFiles.length > 0,
      baselineCommitted: component.baseline.visualBaselineStatus === "committed",
    };
  });
  const literalCkbV2RootCount = surfaces
    .flatMap((surface) => surface.roots)
    .filter((rootFact) => rootFact.literalCkbV2).length;
  const dynamicCkbV2RootCount = surfaces
    .flatMap((surface) => surface.roots)
    .filter((rootFact) => rootFact.dynamicCkbV2).length;
  const discoveredRoutes = productionPageRoutes(root);
  const routeOwners = new Map();
  for (const surface of contract.productionSurfaces) {
    for (const route of surface.routes) {
      const owners = routeOwners.get(route) ?? [];
      owners.push(surface.id);
      routeOwners.set(route, owners);
    }
  }
  const declaredRoutes = [...routeOwners.keys()].sort();
  const undeclaredRoutes = discoveredRoutes.filter((route) => !routeOwners.has(route));
  const duplicateRoutes = [...routeOwners.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([route, owners]) => ({ route, owners }))
    .sort((left, right) => left.route.localeCompare(right.route));
  const missingRoutes = declaredRoutes.filter((route) => !discoveredRoutes.includes(route));
  return {
    schemaVersion: contract.schemaVersion,
    baseline: contract.baseline,
    requiredProofCategories: [...contract.requiredProofCategories],
    components,
    surfaces,
    routeCoverage: {
      discovered: discoveredRoutes,
      declared: declaredRoutes,
      undeclared: undeclaredRoutes,
      missing: missingRoutes,
      duplicates: duplicateRoutes,
    },
    adoption: { literalCkbV2RootCount, dynamicCkbV2RootCount },
    summary: {
      registeredComponentCount: components.length,
      previewCount: components.filter((component) => component.designSync.previewValid).length,
      productImportedComponentCount: components.filter((component) => component.productImportFiles.length > 0).length,
      rootCount: surfaces.flatMap((surface) => surface.roots).length,
      productionRouteCount: discoveredRoutes.length,
    },
  };
}

export function checkAdoptionManifest(manifest, { root = ROOT } = {}) {
  const contract = JSON.parse(read(CONTRACT_PATH, root));
  const failures = [];
  for (const component of manifest.components) {
    for (const fact of ["built", "locallyRegistered", "v2ShellMounted", "proofDeclared", "baselineCommitted"])
      if (typeof component[fact] !== "boolean") failures.push(`${component.name} is missing boolean ${fact} fact`);
    if (!component.source || !component.sourceExported)
      failures.push(`${component.name} is not exported from its declared source`);
    if (!component.entryExported) failures.push(`${component.name} is missing from .design-sync/entry.tsx`);
    if (!component.designSync.listedInDtsProps) failures.push(`${component.name} is missing dtsPropsFor metadata`);
    if (!component.designSync.previewValid) failures.push(`${component.name} is missing a valid design-sync preview`);
    if (component.testFiles.length === 0) failures.push(`${component.name} has no direct test proof`);
  }
  for (const surface of manifest.surfaces) {
    const proof = surface.proof && typeof surface.proof === "object" ? surface.proof : {};
    const requiredProofCategories = Array.isArray(contract.requiredProofCategories)
      ? contract.requiredProofCategories
      : [];
    for (const category of requiredProofCategories) {
      const declaration = proof[category];
      if (!declaration || typeof declaration !== "object") {
        failures.push(`${surface.id} surface proof is missing ${category}`);
        continue;
      }
      if (!SURFACE_PROOF_STATUSES.has(declaration.status))
        failures.push(`${surface.id} ${category} proof has invalid status: ${String(declaration.status)}`);
      const validEvidence =
        Array.isArray(declaration.evidence) && declaration.evidence.every((entry) => typeof entry === "string");
      if (!validEvidence) failures.push(`${surface.id} ${category} proof evidence must be a string array`);
      if (declaration.status === "passed" && (!validEvidence || declaration.evidence.length === 0))
        failures.push(`${surface.id} ${category} proof is passed without evidence`);
      if (declaration.status === "passed" && validEvidence) {
        for (const evidencePath of declaration.evidence)
          if (!exists(evidencePath, root))
            failures.push(`${surface.id} ${category} proof evidence is missing: ${evidencePath}`);
      }
      if (surface.shellState === "v2" && declaration.status !== "passed")
        failures.push(`${surface.id} v2 adoption requires passed ${category} proof`);
    }
    for (const category of Object.keys(proof)) {
      if (!requiredProofCategories.includes(category))
        failures.push(`${surface.id} declares unknown surface proof category: ${category}`);
    }
    if (!surface.baseline || typeof surface.baseline !== "object") {
      failures.push(`${surface.id} surface baseline declaration is missing`);
    } else {
      if (!BASELINE_STATUSES.has(surface.baseline.status))
        failures.push(`${surface.id} surface baseline has invalid status: ${String(surface.baseline.status)}`);
      const validBaselineFiles =
        Array.isArray(surface.baseline.files) && surface.baseline.files.every((entry) => typeof entry === "string");
      if (!validBaselineFiles) failures.push(`${surface.id} surface baseline files must be a string array`);
      if (surface.baseline.status === "committed" && (!validBaselineFiles || surface.baseline.files.length === 0))
        failures.push(`${surface.id} surface baseline is committed without files`);
      if (surface.baseline.status === "committed" && validBaselineFiles) {
        for (const baselinePath of surface.baseline.files)
          if (!exists(baselinePath, root))
            failures.push(`${surface.id} surface baseline file is missing: ${baselinePath}`);
      }
      if (surface.shellState === "v2" && surface.baseline.status !== "committed")
        failures.push(`${surface.id} v2 adoption requires a committed visual baseline`);
    }
    for (const rootFact of surface.roots) {
      if (!rootFact.exists) failures.push(`${surface.id} root is missing: ${rootFact.file}`);
      if (rootFact.dynamicCkbV2) failures.push(`${surface.id} root dynamically constructs ckb-v2: ${rootFact.file}`);
      if (surface.shellState === "compatibility" && rootFact.literalCkbV2)
        failures.push(`${surface.id} declares compatibility but opts into ckb-v2: ${rootFact.file}`);
      for (const family of rootFact.importedFamilies) {
        if (!surface.permittedComponentFamilies.includes(family))
          failures.push(`${surface.id} imports an unpermitted ${family} component`);
      }
    }
    if (surface.disposition !== "owned" && !surface.documentedDisposition)
      failures.push(`${surface.id} ${surface.disposition} disposition is undocumented`);
  }
  for (const route of manifest.routeCoverage.undeclared) failures.push(`production page route is undeclared: ${route}`);
  for (const route of manifest.routeCoverage.missing)
    failures.push(`declared production page route is missing: ${route}`);
  for (const duplicate of manifest.routeCoverage.duplicates)
    failures.push(`production page route has multiple owners: ${duplicate.route} (${duplicate.owners.join(", ")})`);
  const sourceMapNames = Object.keys(JSON.parse(read(CONFIG_PATH, root)).componentSrcMap ?? {}).sort();
  const familyNames = Object.keys(contract.componentFamilies).sort();
  if (JSON.stringify(sourceMapNames) !== JSON.stringify(familyNames))
    failures.push("adoption componentFamilies must match the design-sync visual component registry");
  if (manifest.requiredProofCategories.join("|") !== contract.requiredProofCategories.join("|"))
    failures.push("required proof categories drifted from adoption contract");
  return failures;
}

async function writeOrCheck(relativePath, content, write) {
  const absolutePath = path.join(ROOT, relativePath);
  const prettierOptions = (await prettier.resolveConfig(absolutePath)) ?? {};
  const formatted = await prettier.format(content, { ...prettierOptions, filepath: absolutePath });
  const current = exists(relativePath) ? read(relativePath) : "";
  if (current === formatted) return [];
  if (write) {
    fs.mkdirSync(path.dirname(path.join(ROOT, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, relativePath), formatted);
    return [];
  }
  return [`${relativePath} is out of date; run npm run design-system:adoption:update`];
}

async function main() {
  const write = process.argv.includes("--write");
  const check = process.argv.includes("--check");
  if (write === check) throw new Error("Pass exactly one of --write or --check.");
  const manifest = buildAdoptionManifest();
  const failures = checkAdoptionManifest(manifest);
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  failures.push(...(await writeOrCheck(MANIFEST_PATH, serialized, write)));
  const sections = manifestSections(manifest);
  failures.push(
    ...(await writeOrCheck(
      "docs/design-system/COMPONENTS.md",
      replaceMarkedSection(
        read("docs/design-system/COMPONENTS.md"),
        "<!-- adoption-manifest:maturity:start -->",
        "<!-- adoption-manifest:maturity:end -->",
        sections.maturity,
      ),
      write,
    )),
  );
  failures.push(
    ...(await writeOrCheck(
      "docs/design-system/ADOPTION.md",
      replaceMarkedSection(
        read("docs/design-system/ADOPTION.md"),
        "<!-- adoption-manifest:adoption:start -->",
        "<!-- adoption-manifest:adoption:end -->",
        sections.adoption,
      ),
      write,
    )),
  );
  if (failures.length) throw new Error(failures.join("\n"));
  process.stdout.write(
    `design-system adoption ${write ? "updated" : "checked"}: ${manifest.summary.registeredComponentCount} components, ${manifest.summary.rootCount} roots\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    throw error;
  });
}
