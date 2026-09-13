import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import rule from "../eslint-rules/require-lucide-icon-aria.mjs";

/**
 * The icon-aria gate is only worth having if it still fires. `npm run lint`
 * going green proves the repo is clean, not that the rule can fail — a rule
 * that silently matches nothing looks identical from the outside, and this one
 * spent its life with two structural blind spots that a green lint could never
 * have revealed: member-expression tags (`<item.icon />`) were skipped outright,
 * and identifier matching was hard-coded to the two names `Icon`/`ActiveIcon`,
 * so the same icon-in-a-value pattern under any other local name (`HitIcon`,
 * `GroupIcon`, `SelectedTabIcon`, …) was invisible.
 *
 * These cases pin both directions for all three in-scope tag shapes, and in
 * particular the wrapper-component exclusion — the mechanism that lets the rule
 * match every `*Icon` name without firing on components such as `ToolIcon` or
 * `NoticeIcon`, which render an already-marked svg internally.
 */
const linter = new Linter();

const config = {
  languageOptions: {
    parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: "latest", sourceType: "module" },
  },
  plugins: { local: { rules: { "require-lucide-icon-aria": rule } } },
  rules: { "local/require-lucide-icon-aria": "error" },
} as const;

function lint(code: string) {
  return linter.verify(code, config as never);
}

function messageIds(code: string) {
  return lint(code).map((message) => message.messageId);
}

function fixed(code: string) {
  return linter.verifyAndFix(code, config as never).output;
}

const LUCIDE_IMPORT = 'import { ChevronRight } from "lucide-react";\n';

describe("require-lucide-icon-aria", () => {
  describe("shape 1 — a value imported from lucide-react", () => {
    it("flags a bare lucide icon", () => {
      expect(messageIds(`${LUCIDE_IMPORT}export const A = () => <ChevronRight className="h-4" />;`)).toEqual([
        "missing",
      ]);
    });

    it("accepts one that declares intent", () => {
      expect(messageIds(`${LUCIDE_IMPORT}export const A = () => <ChevronRight aria-hidden="true" />;`)).toEqual([]);
    });

    it("ignores an identically named tag that is not the lucide import", () => {
      expect(messageIds("export const A = () => <ChevronRight />;")).toEqual([]);
    });
  });

  describe("shape 2 — an identifier ending in Icon", () => {
    it("still flags the two names the rule used to hard-code", () => {
      expect(messageIds("export function R({ item }) { const Icon = item.icon; return <Icon />; }")).toEqual([
        "missing",
      ]);
      expect(
        messageIds("export function R({ item }) { const ActiveIcon = item.activeIcon; return <ActiveIcon />; }"),
      ).toEqual(["missing"]);
    });

    it("flags a name the old hard-coded pair missed", () => {
      // The real defect this widening closed: universal-search-command-surface's
      // <HitIcon /> reached the a11y tree beside a visible title.
      expect(messageIds("export function R({ hit }) { const HitIcon = hit.icon; return <HitIcon />; }")).toEqual([
        "missing",
      ]);
      expect(messageIds("export function R({ icon: TrailingIcon }) { return <TrailingIcon />; }")).toEqual(["missing"]);
    });

    it("does not flag a tag whose name does not end in Icon", () => {
      expect(messageIds("export function R({ item }) { const Glyph = item.icon; return <Glyph />; }")).toEqual([]);
      expect(messageIds("export const A = () => <IconButton />;")).toEqual([]);
    });
  });

  describe("shape 3 — a member-expression tag", () => {
    it("flags an icon-shaped property", () => {
      expect(messageIds("export const A = ({ item }) => <item.icon className='h-4' />;")).toEqual(["missing"]);
      expect(messageIds("export const A = ({ config }) => <config.Icon />;")).toEqual(["missing"]);
    });

    it("accepts one that declares intent", () => {
      expect(messageIds('export const A = ({ item }) => <item.icon aria-hidden="true" />;')).toEqual([]);
    });

    it("does not flag an arbitrary member tag", () => {
      expect(messageIds("export const A = () => <Foo.Provider value={v} />;")).toEqual([]);
      expect(messageIds("export const A = () => <motion.div />;")).toEqual([]);
      expect(messageIds("export const A = ({ theme }) => <theme.Wrapper />;")).toEqual([]);
    });

    it("reports the whole dotted tag name", () => {
      expect(lint("export const A = ({ a }) => <a.b.icon />;")[0]?.message).toContain("<a.b.icon>");
    });
  });

  describe("wrapper-component exclusion", () => {
    // Chosen mechanism: resolve the tag name through scope analysis and skip a
    // name that is a component declared in this module (or imported from
    // another). No hand-maintained allowlist to drift.
    it("does not flag a locally declared function component whose name ends in Icon", () => {
      expect(
        messageIds("function ToolIcon({ app }) { return <span />; }\nexport const A = () => <ToolIcon />;"),
      ).toEqual([]);
    });

    it("does not flag an arrow, memo, or forwardRef component", () => {
      expect(messageIds("const NoticeIcon = () => <span />;\nexport const A = () => <NoticeIcon />;")).toEqual([]);
      expect(messageIds("const BrandIcon = memo(() => <span />);\nexport const A = () => <BrandIcon />;")).toEqual([]);
      expect(
        messageIds("const RowIcon = React.forwardRef(() => <span />);\nexport const A = () => <RowIcon />;"),
      ).toEqual([]);
    });

    it("does not flag an imported binding, which may be a wrapper in another module", () => {
      expect(messageIds('import { FancyIcon } from "./icons";\nexport const A = () => <FancyIcon />;')).toEqual([]);
    });

    it("still flags a name bound to an icon value rather than to a component", () => {
      // The exclusion must key on "is a component", not on "is declared".
      expect(messageIds("export function R({ item }) { const RowIcon = item.icon; return <RowIcon />; }")).toEqual([
        "missing",
      ]);
      expect(
        messageIds("export function R({ a, b, on }) { const PillIcon = on ? a : b; return <PillIcon />; }"),
      ).toEqual(["missing"]);
      expect(
        messageIds("export function R({ item }) { const DomainIcon = pick(item); return <DomainIcon />; }"),
      ).toEqual(["missing"]);
    });

    it("holds a lucide import to the contract even though it is an import", () => {
      // The lucide check runs first, so the import exclusion cannot swallow it.
      expect(messageIds('import { StarIcon } from "lucide-react";\nexport const A = () => <StarIcon />;')).toEqual([
        "missing",
      ]);
    });
  });

  describe("attributes that satisfy the rule", () => {
    for (const attr of ["aria-hidden", "aria-label", "aria-labelledby", "role", "title"]) {
      it(`accepts ${attr}`, () => {
        expect(messageIds(`${LUCIDE_IMPORT}export const A = () => <ChevronRight ${attr}="x" />;`)).toEqual([]);
        expect(messageIds(`export const A = ({ item }) => <item.icon ${attr}="x" />;`)).toEqual([]);
      });
    }

    it("keeps the spread escape hatch, since aria-* may arrive dynamically", () => {
      expect(messageIds(`${LUCIDE_IMPORT}export const A = (p) => <ChevronRight {...p} />;`)).toEqual([]);
      expect(messageIds("export const A = ({ item, ...p }) => <item.icon {...p} />;")).toEqual([]);
      expect(
        messageIds("export function R({ hit, ...p }) { const HitIcon = hit.icon; return <HitIcon {...p} />; }"),
      ).toEqual([]);
    });
  });

  describe("autofix", () => {
    it("inserts aria-hidden after an identifier tag name", () => {
      expect(
        fixed("export function R({ hit }) { const HitIcon = hit.icon; return <HitIcon className='h-4' />; }"),
      ).toBe(
        "export function R({ hit }) { const HitIcon = hit.icon; return <HitIcon aria-hidden=\"true\" className='h-4' />; }",
      );
    });

    it("inserts aria-hidden after a member-expression tag name", () => {
      expect(fixed("export const A = ({ item }) => <item.icon className='h-4' />;")).toBe(
        "export const A = ({ item }) => <item.icon aria-hidden=\"true\" className='h-4' />;",
      );
    });
  });
});
