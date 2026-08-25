import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { deriveDesignSyncProps } from "../scripts/generate-design-sync-contract.mjs";

const root = path.resolve(__dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

const visualExports = [
  "AccessibleTable",
  "AnswerCard",
  "AnswerFooter",
  "AsyncButton",
  "Breadcrumb",
  "Button",
  "Checkbox",
  "Chip",
  "ChoiceChip",
  "Citation",
  "CitationList",
  "ConfirmDialog",
  "DateDisplay",
  "Disclosure",
  "DisclosureGroup",
  "DoseLine",
  "DownloadLink",
  "EmptyState",
  "ErrorState",
  "ErrorSummary",
  "ExternalTextLink",
  "FieldError",
  "FieldHint",
  "FormField",
  "IconButton",
  "InlineNotice",
  "LinkAction",
  "LoadingPanel",
  "MissingValue",
  "OverlayRoot",
  "PageHeader",
  "Pagination",
  "PanelHeading",
  "Progress",
  "Quantity",
  "RadioGroup",
  "RetrievalStateBanner",
  "SafeBoldText",
  "SearchField",
  "SegmentedControl",
  "Select",
  "Sheet",
  "Skeleton",
  "SourceDesignationBadge",
  "SourceProvenance",
  "SourceStatusBadge",
  "StageList",
  "StatusMark",
  "Tabs",
  "TextField",
  "TextLink",
  "ToastRegion",
  "ToggleSwitch",
  "Tooltip",
  "VerificationNotice",
] as const;

describe("design-sync visual exports", () => {
  const config = JSON.parse(read(".design-sync/config.json"));

  it("registers every current visual export with generated props metadata", () => {
    expect(Object.keys(config.componentSrcMap).sort()).toEqual([...visualExports].sort());
    expect(config.dtsPropsFor).toEqual(deriveDesignSyncProps({ root, config }));
  });

  it.each(visualExports)("publishes a direct %s preview", (component) => {
    const preview = read(`.design-sync/previews/${component}.tsx`);
    expect(preview).toMatch(
      new RegExp(`import\\s*\\{[^}]*\\b${component}\\b[^}]*\\}\\s*from\\s*["']${config.pkg}["']`),
    );
  });

  it("records the final high-drift API contracts", () => {
    expect(config.dtsPropsFor.Chip).toContain("appearance?: ChipAppearance");
    expect(config.dtsPropsFor.Chip).toContain("size?: ChipSize");
    expect(config.dtsPropsFor.ChoiceChip).toContain("pressed: boolean");
    expect(config.dtsPropsFor.ChoiceChip).toContain("onPressedChange: (pressed: boolean) => void");
    expect(config.dtsPropsFor.SegmentedControl).toContain("options: readonly SegmentedControlOption<string>[]");
    expect(config.dtsPropsFor.OverlayRoot).toBe("");
    expect(config.dtsPropsFor.EmptyState).toContain('live?: "off" | "assertive" | "polite"');
    expect(config.dtsPropsFor.VerificationNotice).toContain('presentation?: "full" | "responsive-compact"');
    expect(config.dtsPropsFor.AccessibleTable).toContain("caption: string");
    expect(config.dtsPropsFor.AccessibleTable).not.toContain("caption?:");
    expect(config.dtsPropsFor.ConfirmDialog).toContain("confirmLabel: string");
    expect(config.dtsPropsFor.ConfirmDialog).not.toContain("confirmLabel?:");
    expect(config.dtsPropsFor.Tooltip).toContain("content: string");
  });
});
