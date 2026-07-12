/**
 * Local ESLint rule: a lucide-react icon rendered as a JSX element must declare
 * its accessibility intent — either `aria-hidden` (decorative, the common case)
 * or an accessible name (`aria-label` / `aria-labelledby` / `role` / `title`).
 *
 * This enforces the codebase's existing convention (574 aria-hidden across the
 * app) so a decorative glyph can't silently reach the accessibility tree. It
 * only inspects JSX whose tag name is imported directly from "lucide-react";
 * icons passed around as `icon: LucideIcon` values are out of scope (their aria
 * is set where they render). Elements that spread props ({...rest}) are skipped,
 * since the aria attribute may arrive dynamically.
 */

const ACCESSIBILITY_ATTRS = new Set(["aria-hidden", "aria-label", "aria-labelledby", "role", "title"]);

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    // Auto-fix adds aria-hidden="true" (the decorative default). Safe: a bare
    // lucide <svg> has no accessible name, so hiding it never removes a control's
    // name — an icon-only button that needs a name was already unlabeled and is
    // caught separately by runtime axe checks.
    fixable: "code",
    docs: {
      description: "Require lucide-react icons to be decorative (aria-hidden) or to carry an accessible name.",
    },
    schema: [],
    messages: {
      missing:
        'Lucide icon <{{name}}> needs aria-hidden="true" (if decorative) or an accessible name (aria-label / aria-labelledby / role / title).',
    },
  },
  create(context) {
    /** Local identifiers imported as values from lucide-react. */
    const lucideValueImports = new Set();

    return {
      ImportDeclaration(node) {
        if (node.source.value !== "lucide-react") return;
        if (node.importKind === "type") return; // whole `import type { … }`
        for (const spec of node.specifiers) {
          if (spec.type !== "ImportSpecifier" && spec.type !== "ImportDefaultSpecifier") continue;
          if (spec.importKind === "type") continue; // inline `type X`
          lucideValueImports.add(spec.local.name);
        }
      },
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier") return;
        if (!lucideValueImports.has(node.name.name)) return;
        // A spread ({...props}) may inject aria-* dynamically — don't flag.
        if (node.attributes.some((attr) => attr.type === "JSXSpreadAttribute")) return;
        const declaresIntent = node.attributes.some(
          (attr) =>
            attr.type === "JSXAttribute" &&
            attr.name.type === "JSXIdentifier" &&
            ACCESSIBILITY_ATTRS.has(attr.name.name),
        );
        if (declaresIntent) return;
        context.report({
          node,
          messageId: "missing",
          data: { name: node.name.name },
          fix: (fixer) => fixer.insertTextAfter(node.name, ' aria-hidden="true"'),
        });
      },
    };
  },
};

export default rule;
