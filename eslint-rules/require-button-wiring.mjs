/**
 * Local ESLint rule: an explicit `<button type="button">` must be wired to a
 * behaviour — an event handler, a form action, or an explicit disabled state.
 *
 * `type="button"` opts a button out of form submission, so on its own it does
 * *nothing* when clicked. Such a button that carries no `onClick` and no
 * `disabled`/`aria-disabled` state is a control that advertises an action it
 * cannot perform — the "Language and region" globe defect
 * (master-search-header.tsx, fixed 2026-07-21). This rule makes that class of
 * dead button fail `npm run lint`.
 *
 * Deliberately narrow to keep false positives at zero:
 *  - Only `<button>` elements whose `type` is the string literal `"button"` are
 *    inspected. Submit/reset buttons and buttons with a dynamic/absent `type`
 *    (which may default to submit inside a <form>) are left alone.
 *  - Any spread ({...props}) skips the element, since a handler may arrive
 *    dynamically (same escape hatch as require-lucide-icon-aria).
 *  - An unbuilt feature is expressed the codebase's way — `disabled` or
 *    `aria-disabled` (typically with a "coming soon" note) — and passes.
 *
 * There is no auto-fix: wiring a button requires knowing what it should do, so
 * the fix is a human decision (add the handler, or make it an explicit
 * disabled placeholder). Design-scratch mockups are exempt via eslint.config.mjs.
 */

/** Attribute names (besides `onClick`) that mark a <button type="button"> as wired. */
const EXPLICIT_WIRING_ATTRS = new Set(["disabled", "aria-disabled"]);

/** True when the JSX attribute is `type="button"` (string literal). */
function isTypeButton(attr) {
  if (attr.type !== "JSXAttribute") return false;
  if (attr.name.type !== "JSXIdentifier" || attr.name.name !== "type") return false;
  const { value } = attr;
  if (!value) return false;
  if (value.type === "Literal") return value.value === "button";
  // `type={"button"}` — a literal wrapped in an expression container.
  if (value.type === "JSXExpressionContainer" && value.expression.type === "Literal") {
    return value.expression.value === "button";
  }
  return false;
}

/**
 * True when the attribute wires click behaviour. Only `onClick` counts as a
 * handler: other `on*` events (onFocus/onMouseEnter) leave a click doing
 * nothing, and `formAction` has no submit effect on a non-submit button.
 */
function isWiringAttr(attr) {
  if (attr.type !== "JSXAttribute") return false;
  if (attr.name.type !== "JSXIdentifier") return false;
  const name = attr.name.name;
  return name === "onClick" || EXPLICIT_WIRING_ATTRS.has(name);
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        'Require an explicit `<button type="button">` to carry an onClick handler or an explicit disabled state.',
    },
    schema: [],
    messages: {
      unwired:
        'This <button type="button"> has no onClick and no disabled/aria-disabled state — it does nothing when clicked. Wire it with onClick, or make it an explicit disabled "coming soon" placeholder.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "button") return;
        // A spread may inject a handler dynamically — don't flag.
        if (node.attributes.some((attr) => attr.type === "JSXSpreadAttribute")) return;
        // Only inspect explicit type="button"; submit/reset/dynamic are out of scope.
        if (!node.attributes.some((attr) => isTypeButton(attr))) return;
        if (node.attributes.some((attr) => isWiringAttr(attr))) return;
        context.report({ node, messageId: "unwired" });
      },
    };
  },
};

export default rule;
