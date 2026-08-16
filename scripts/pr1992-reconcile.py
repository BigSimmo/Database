#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def stage(path: str, number: int) -> str:
    return subprocess.check_output(["git", "show", f":{number}:{path}"], text=True)


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def replace_unless_present(text: str, old: str, new: str, present: str, label: str) -> str:
    if present in text:
        return text
    return replace_once(text, old, new, label)


def between(text: str, start: str, end: str, label: str) -> str:
    start_index = text.find(start)
    end_index = text.find(end, start_index + len(start))
    if start_index < 0 or end_index < 0:
        raise RuntimeError(f"{label}: markers not found")
    return text[start_index:end_index]


def insert_before_final_suite_close(text: str, block: str, label: str) -> str:
    index = text.rfind("\n});")
    if index < 0:
        raise RuntimeError(f"{label}: final suite close not found")
    return text[:index] + "\n" + block.rstrip() + "\n" + text[index:]


def resolve_conflicts() -> None:
    # Generated documents start from current main and are regenerated later.
    for generated in (
        "docs/design-system/adoption-manifest.json",
        "docs/site-map.md",
    ):
        write(generated, stage(generated, 3))

    # Preserve main's redesigned favourites library, then add Therapy as a
    # first-class saved registry type from this PR.
    favourites_path = "src/components/clinical-dashboard/favourites-command-library-page.tsx"
    favourites = stage(favourites_path, 3)
    favourites = replace_unless_present(
        favourites,
        '  "Medication" | "Document" | "Table" | "Saved search" | "Source" | "Service" | "Form" | "Differential";',
        '  "Medication" | "Document" | "Table" | "Saved search" | "Source" | "Service" | "Form" | "Differential" | "Therapy";',
        '"Differential" | "Therapy"',
        "FavouriteType Therapy member",
    )
    favourites = replace_unless_present(
        favourites,
        '  Differential: { kind: "information", tone: "accent" },\n};',
        '  Differential: { kind: "information", tone: "accent" },\n'
        '  Therapy: { kind: "information", tone: "accent" },\n};',
        '  Therapy: { kind: "information", tone: "accent" },',
        "Therapy appearance",
    )
    favourites = replace_unless_present(
        favourites,
        '  differentials: "Differential",\n};',
        '  differentials: "Differential",\n  therapies: "Therapy",\n};',
        '  therapies: "Therapy",',
        "Therapy prototype type",
    )
    favourites = replace_unless_present(
        favourites,
        '  differentials: appModeIcons.differentials,\n};',
        '  differentials: appModeIcons.differentials,\n'
        '  therapies: appModeIcons["therapy-compass"],\n};',
        '  therapies: appModeIcons["therapy-compass"],',
        "Therapy fallback icon",
    )
    write(favourites_path, favourites)

    # Start with main's newer Calculators mode and helper changes, but retain
    # the PR's explicit Therapy clinical-review gate and honest search kind.
    modes_path = "src/lib/app-modes.ts"
    modes_ours = stage(modes_path, 2)
    modes = stage(modes_path, 3)
    therapy_block = between(
        modes_ours,
        '  {\n    id: "therapy-compass",',
        '  {\n    id: "factsheets",',
        "ours Therapy mode block",
    )
    main_therapy_block = between(
        modes,
        '  {\n    id: "therapy-compass",',
        '  {\n    id: "factsheets",',
        "main Therapy mode block",
    )
    modes = replace_once(modes, main_therapy_block, therapy_block, "Therapy mode governance overlay")
    modes = replace_unless_present(
        modes,
        '  | "formulation"\n  | "calculators"',
        '  | "formulation"\n  | "therapies"\n  | "calculators"',
        '  | "therapies"\n',
        "Therapy search kind",
    )
    modes = replace_unless_present(
        modes,
        '    const namespacedHref =\n'
        '      query && modeId === "dsm" ? "/dsm/search" : query && modeId === "factsheets" ? "/factsheets/search" : mode.href;',
        '    const namespacedHref =\n'
        '      query && modeId === "dsm"\n'
        '        ? "/dsm/search"\n'
        '        : query && modeId === "factsheets"\n'
        '          ? "/factsheets/search"\n'
        '          : query && modeId === "therapy-compass"\n'
        '            ? "/therapy-compass/search"\n'
        '            : mode.href;',
        'query && modeId === "therapy-compass"',
        "Therapy submitted-search route",
    )
    modes = replace_unless_present(
        modes,
        '    kind === "formulation" ||\n    kind === "calculators" ||',
        '    kind === "formulation" ||\n    kind === "therapies" ||\n    kind === "calculators" ||',
        'kind === "therapies"',
        "Therapy searchable kind",
    )
    if 'id: "calculators"' not in modes or "devOnly: true" not in therapy_block:
        raise RuntimeError("app-modes merge lost Calculators or Therapy governance")
    write(modes_path, modes)

    # Retain this PR's routed Therapy ModeNav and state carry-over, while
    # registering main's new single-surface Calculators mode.
    secondary_path = "src/lib/mode-secondary-navigation.ts"
    secondary = stage(secondary_path, 2)
    secondary = replace_unless_present(
        secondary,
        "  tools: [],\n",
        "  tools: [],\n  calculators: [],\n",
        "  calculators: [],",
        "Calculators secondary registry",
    )
    secondary = secondary.replace("These seven modes", "These eight modes")
    write(secondary_path, secondary)

    # Keep main's expanded app-mode regression suite, then restore Therapy's
    # unreviewed-production expectations and dedicated search route.
    app_modes_test_path = "tests/app-modes.test.ts"
    app_modes_test_ours = stage(app_modes_test_path, 2)
    app_modes_test = stage(app_modes_test_path, 3)
    therapy_search_test = between(
        app_modes_test_ours,
        '  it("routes Therapy searches as a first-class local catalogue",',
        '  it("keeps source-library shortcut searches',
        "Therapy app-mode search test",
    )
    insertion_marker = '  it("keeps source-library shortcut searches'
    if "routes Therapy searches as a first-class local catalogue" not in app_modes_test:
        marker_index = app_modes_test.find(insertion_marker)
        if marker_index < 0:
            raise RuntimeError("app-modes test insertion marker missing")
        app_modes_test = app_modes_test[:marker_index] + therapy_search_test + app_modes_test[marker_index:]

    app_modes_test = replace_unless_present(
        app_modes_test,
        '    expect(isAppModeVisible("therapy-compass", "production")).toBe(true);\n'
        '    expect(isAppModeVisible("factsheets", "production")).toBe(true);',
        '    expect(isAppModeVisible("therapy-compass", "production")).toBe(false);\n'
        '    expect(isAppModeVisible("factsheets", "production")).toBe(true);',
        'expect(isAppModeVisible("therapy-compass", "production")).toBe(false);',
        "production Therapy visibility",
    )
    app_modes_test = replace_unless_present(
        app_modes_test,
        '    expect(productionModes).toContain("therapy-compass");\n',
        '    expect(productionModes).not.toContain("therapy-compass");\n',
        'expect(productionModes).not.toContain("therapy-compass");',
        "production Therapy list",
    )
    gate_test = between(
        app_modes_test_ours,
        '  it("keeps Therapy Compass behind clinical review in production",',
        '  it("gates Favourites mode',
        "Therapy clinical-review gate test",
    )
    if "surfaces Therapy Compass in production discovery after clinician sign-off" in app_modes_test:
        signed_off_test = between(
            app_modes_test,
            '  it("surfaces Therapy Compass in production discovery after clinician sign-off",',
            '  it("gates Favourites mode',
            "main signed-off Therapy test",
        )
        app_modes_test = replace_once(
            app_modes_test,
            signed_off_test,
            gate_test,
            "Therapy gate test overlay",
        )
    elif "keeps Therapy Compass behind clinical review in production" not in app_modes_test:
        raise RuntimeError("Therapy governance test missing")

    app_modes_test = replace_unless_present(
        app_modes_test,
        '      // Therapy resolves to its home, which server-redirects to /therapy-compass/search.\n'
        '      "therapy-compass": "/therapy-compass?q=clozapine&run=1",',
        '      "therapy-compass": "/therapy-compass/search?q=clozapine&run=1",',
        '"therapy-compass": "/therapy-compass/search?q=clozapine&run=1",',
        "Therapy submitted URL expectation",
    )
    write(app_modes_test_path, app_modes_test)

    # Keep the PR's routed Therapy navigation tests and add Calculators to
    # every exhaustive mode registry assertion introduced on main.
    secondary_test_path = "tests/mode-secondary-navigation.test.ts"
    secondary_test = stage(secondary_test_path, 2)
    secondary_test = secondary_test.replace(
        "/** Seven modes intentionally register no destinations at all",
        "/** Eight modes intentionally register no destinations at all",
    )
    secondary_test = replace_unless_present(
        secondary_test,
        "  tools: [],\n",
        "  tools: [],\n  calculators: [],\n",
        "  calculators: [],",
        "Calculators expected labels",
    )
    secondary_test = replace_unless_present(
        secondary_test,
        '  tools: "/tools",\n',
        '  tools: "/tools",\n  calculators: "/calculators",\n',
        '  calculators: "/calculators",',
        "Calculators clean landing",
    )
    secondary_test = replace_unless_present(
        secondary_test,
        '  "tools",\n] as const satisfies readonly AppModeId[];',
        '  "tools",\n  "calculators",\n] as const satisfies readonly AppModeId[];',
        '  "calculators",\n] as const',
        "Calculators empty registry list",
    )
    secondary_test = secondary_test.replace(
        "The seven modes that register nothing",
        "The eight modes that register nothing",
    )
    secondary_test = secondary_test.replace("covers all 13 modes", "covers all 14 modes")
    secondary_test = secondary_test.replace("toHaveLength(13)", "toHaveLength(14)")
    secondary_test = secondary_test.replace(
        "registers no destinations at all for the seven single-surface modes",
        "registers no destinations at all for the eight single-surface modes",
    )
    secondary_test = secondary_test.replace("silences the seven above", "silences the eight above")
    write(secondary_test_path, secondary_test)


def add_tests() -> None:
    provider_path = Path("tests/therapy-compass-provider-seed.dom.test.tsx")
    provider = provider_path.read_text(encoding="utf-8")
    start = provider.find('  it("preserves a locally typed query when only workspace filter parameters change"')
    end = provider.find('  it("resolves a therapy detail screen + slug from the pathname"', start)
    if start < 0 or end < 0:
        raise RuntimeError("provider query-preservation test markers missing")
    segment = provider[start:end]
    segment = replace_unless_present(
        segment,
        '    navState.search = "";\n',
        '    navState.search = "q=alpha";\n',
        '    navState.search = "q=alpha";',
        "stale q setup",
    )
    segment = replace_unless_present(
        segment,
        '    navState.search = "brief=1";\n',
        '    navState.search = "q=alpha&brief=1";\n',
        '    navState.search = "q=alpha&brief=1";',
        "stale q filter navigation",
    )
    provider = provider[:start] + segment + provider[end:]
    provider_path.write_text(provider, encoding="utf-8")

    navigation_path = Path("tests/therapy-compass-navigation.test.ts")
    navigation = navigation_path.read_text(encoding="utf-8")
    canonical_test = r'''
  it("serializes patient-sheet sections in canonical order", () => {
    const params = therapyWorkspaceSearchParams(new URLSearchParams(), {
      ...DEFAULT_THERAPY_WORKSPACE_STATE,
      sections: ["contacts", "about", "practice"],
    });

    expect(params.getAll("section")).toEqual(["about", "practice", "contacts"]);
    expect(readTherapyWorkspaceState(params).sections).toEqual(["about", "practice", "contacts"]);
  });
'''
    if "serializes patient-sheet sections in canonical order" not in navigation:
        navigation = insert_before_final_suite_close(
            navigation,
            canonical_test,
            "canonical Therapy section test",
        )
    navigation_path.write_text(navigation, encoding="utf-8")

    review_path = Path("tests/therapy-review-regressions.test.ts")
    review = review_path.read_text(encoding="utf-8")
    follow_up_test = r'''
  it("keeps follow-up Therapy review fixes canonical, token-backed, and single-pass", () => {
    const home = source("src/components/therapy-compass/screens/home-screen.tsx");
    const detail = source("src/components/therapy-compass/screens/detail-screen.tsx");
    const select = source("src/components/therapy-compass/data/select.ts");
    const globals = source("src/app/globals.css");
    const universalSearch = source("tests/ui-universal-search.spec.ts");

    expect(home).toContain('therapyScreenHref("recommend")');
    expect(home).toContain('therapyScreenHref("pathways")');
    expect(home).toContain('therapyScreenHref("compare")');
    expect(home).not.toContain('href: "/therapy-compass/');
    expect(home).not.toContain("`/therapy-compass/search?q=");

    const searchStart = select.indexOf("export function searchTherapies");
    const searchEnd = select.indexOf("// ---- related", searchStart);
    expect(searchStart).toBeGreaterThanOrEqual(0);
    expect(searchEnd).toBeGreaterThan(searchStart);
    const searchImplementation = select.slice(searchStart, searchEnd);
    expect(searchImplementation.match(/scoreTherapyCandidate\(/g)).toHaveLength(1);

    expect(detail).toContain("top-[calc(var(--shell-header-h)+1rem)]");

    const printStart = globals.indexOf("  [data-print-provenance] {", globals.indexOf("@media print"));
    const printEnd = globals.indexOf("\n  }", printStart);
    expect(printStart).toBeGreaterThanOrEqual(0);
    expect(printEnd).toBeGreaterThan(printStart);
    const printProvenance = globals.slice(printStart, printEnd);
    expect(printProvenance).toContain("border-top: 1px solid var(--border);");
    expect(printProvenance).toContain("color: var(--text-muted);");
    expect(printProvenance).not.toContain("#d6dce5");
    expect(printProvenance).not.toContain("#5b6472");

    const groupedStart = universalSearch.indexOf('test("selecting a grouped result navigates to the record"');
    const groupedEnd = universalSearch.indexOf('test("Enter with nothing highlighted', groupedStart);
    expect(groupedStart).toBeGreaterThanOrEqual(0);
    expect(groupedEnd).toBeGreaterThan(groupedStart);
    expect(universalSearch.slice(groupedStart, groupedEnd)).toContain(
      "await expect(option).toBeInViewport();",
    );
  });
'''
    if "keeps follow-up Therapy review fixes canonical" not in review:
        review = insert_before_final_suite_close(
            review,
            follow_up_test,
            "Therapy follow-up source contract",
        )
    review_path.write_text(review, encoding="utf-8")


def apply_fixes() -> None:
    navigation_path = Path("src/lib/therapy-compass-navigation.ts")
    navigation = navigation_path.read_text(encoding="utf-8")
    navigation = replace_unless_present(
        navigation,
        '  if (state.sections.join("|") !== ALL_SHEET_SECTIONS.join("|")) {\n'
        '    if (state.sections.length === 0) params.set("section", "none");\n'
        '    else setRepeated(params, "section", state.sections);\n'
        "  }",
        '  const canonicalSections = ALL_SHEET_SECTIONS.filter((section) => state.sections.includes(section));\n'
        '  if (canonicalSections.join("|") !== ALL_SHEET_SECTIONS.join("|")) {\n'
        '    if (canonicalSections.length === 0) params.set("section", "none");\n'
        '    else setRepeated(params, "section", canonicalSections);\n'
        "  }",
        "const canonicalSections = ALL_SHEET_SECTIONS.filter",
        "canonical sheet section serialization",
    )
    navigation_path.write_text(navigation, encoding="utf-8")

    home_path = Path("src/components/therapy-compass/screens/home-screen.tsx")
    home = home_path.read_text(encoding="utf-8")
    home = replace_unless_present(
        home,
        'import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";\n',
        'import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";\n'
        'import { therapyHrefWithSearchParams, therapyScreenHref } from "@/lib/therapy-compass-navigation";\n',
        'from "@/lib/therapy-compass-navigation"',
        "Therapy home navigation import",
    )
    home = replace_unless_present(
        home,
        'href: "/therapy-compass/recommend",',
        'href: therapyScreenHref("recommend"),',
        'href: therapyScreenHref("recommend"),',
        "recommend href",
    )
    home = replace_unless_present(
        home,
        'href: "/therapy-compass/pathways",',
        'href: therapyScreenHref("pathways"),',
        'href: therapyScreenHref("pathways"),',
        "pathways href",
    )
    home = replace_unless_present(
        home,
        'href: "/therapy-compass/compare",',
        'href: therapyScreenHref("compare"),',
        'href: therapyScreenHref("compare"),',
        "compare href",
    )
    home = replace_unless_present(
        home,
        '          onClick: () => router.push(`/therapy-compass/search?q=${encodeURIComponent(suggestion)}&run=1`),',
        '          onClick: () =>\n'
        "            router.push(\n"
        "              therapyHrefWithSearchParams(\n"
        '                therapyScreenHref("search"),\n'
        '                new URLSearchParams({ q: suggestion, run: "1" }),\n'
        "              ),\n"
        "            ),",
        'therapyHrefWithSearchParams(',
        "suggestion search href",
    )
    home_path.write_text(home, encoding="utf-8")

    detail_path = Path("src/components/therapy-compass/screens/detail-screen.tsx")
    detail = detail_path.read_text(encoding="utf-8")
    detail = replace_unless_present(
        detail,
        "max-sm:static max-sm:top-auto flex flex-col gap-4 sticky top-[84px]",
        "max-sm:static max-sm:top-auto flex flex-col gap-4 sticky top-[calc(var(--shell-header-h)+1rem)]",
        "top-[calc(var(--shell-header-h)+1rem)]",
        "Therapy detail sticky offset",
    )
    detail_path.write_text(detail, encoding="utf-8")

    select_path = Path("src/components/therapy-compass/data/select.ts")
    select = select_path.read_text(encoding="utf-8")
    select = replace_unless_present(
        select,
        "  const scored = therapies\n"
        "    .filter((t) => {\n"
        "      if (!matchesAvailability(t, opts.reviewedOnly, opts.briefOnly)) return false;\n"
        "      if (opts.sheetOnly && !t.patientSheetAvailable) return false;\n"
        "      if (!matchesTopics(t, topics)) return false;\n"
        "      return scoreTherapyCandidate(t, q) > 0;\n"
        "    })\n"
        "    .map((t) => ({ t, s: scoreTherapyCandidate(t, q) }));\n"
        "  scored.sort((a, b) => b.s - a.s || a.t.name.localeCompare(b.t.name));\n"
        "  return scored.map((x) => x.t);",
        "  const scored = therapies\n"
        "    .map((t) => {\n"
        "      if (!matchesAvailability(t, opts.reviewedOnly, opts.briefOnly)) return null;\n"
        "      if (opts.sheetOnly && !t.patientSheetAvailable) return null;\n"
        "      if (!matchesTopics(t, topics)) return null;\n"
        "      const score = scoreTherapyCandidate(t, q);\n"
        "      return score > 0 ? { t, s: score } : null;\n"
        "    })\n"
        "    .filter((candidate): candidate is { t: Therapy; s: number } => candidate !== null);\n"
        "  scored.sort((a, b) => b.s - a.s || a.t.name.localeCompare(b.t.name));\n"
        "  return scored.map((x) => x.t);",
        "const score = scoreTherapyCandidate(t, q);",
        "single-pass Therapy scoring",
    )
    select_path.write_text(select, encoding="utf-8")

    bindings_path = Path("src/components/therapy-compass/bindings.tsx")
    bindings = bindings_path.read_text(encoding="utf-8")
    bindings = replace_unless_present(
        bindings,
        '    const toggleSection = (key: SheetSectionKey) => setSheetSections((prev) => ({ ...prev, [key]: !prev[key] }));',
        '    const toggleSection = (key: SheetSectionKey) => {\n'
        "      const nextSections = { ...sheetSections, [key]: !sheetSections[key] };\n"
        "      setSheetSections(nextSections);\n"
        "      replaceWorkspace({\n"
        "        sections: (Object.entries(nextSections) as Array<[SheetSectionKey, boolean]>)\n"
        "          .filter(([, enabled]) => enabled)\n"
        "          .map(([section]) => section),\n"
        "      });\n"
        "    };",
        "const nextSections = { ...sheetSections",
        "central Therapy section toggle",
    )
    handler_blocks = {
        "About": (
            "about",
            '      toggleAbout: () => {\n'
            '        toggleSection("about");\n'
            "        replaceWorkspace({\n"
            "          sections: sheetSections.about\n"
            '            ? enabledSections.filter((key) => key !== "about")\n'
            '            : [...enabledSections, "about"],\n'
            "        });\n"
            "      },",
        ),
        "Steps": (
            "steps",
            '      toggleSteps: () => {\n'
            '        toggleSection("steps");\n'
            "        replaceWorkspace({\n"
            "          sections: sheetSections.steps\n"
            '            ? enabledSections.filter((key) => key !== "steps")\n'
            '            : [...enabledSections, "steps"],\n'
            "        });\n"
            "      },",
        ),
        "Practice": (
            "practice",
            '      togglePractice: () => {\n'
            '        toggleSection("practice");\n'
            "        replaceWorkspace({\n"
            "          sections: sheetSections.practice\n"
            '            ? enabledSections.filter((key) => key !== "practice")\n'
            '            : [...enabledSections, "practice"],\n'
            "        });\n"
            "      },",
        ),
        "Coping": (
            "coping",
            '      toggleCoping: () => {\n'
            '        toggleSection("coping");\n'
            "        replaceWorkspace({\n"
            "          sections: sheetSections.coping\n"
            '            ? enabledSections.filter((key) => key !== "coping")\n'
            '            : [...enabledSections, "coping"],\n'
            "        });\n"
            "      },",
        ),
        "Contacts": (
            "contacts",
            '      toggleContacts: () => {\n'
            '        toggleSection("contacts");\n'
            "        replaceWorkspace({\n"
            "          sections: sheetSections.contacts\n"
            '            ? enabledSections.filter((key) => key !== "contacts")\n'
            '            : [...enabledSections, "contacts"],\n'
            "        });\n"
            "      },",
        ),
    }
    for name, (key, old) in handler_blocks.items():
        bindings = replace_unless_present(
            bindings,
            old,
            f'      toggle{name}: () => toggleSection("{key}"),',
            f'toggle{name}: () => toggleSection("{key}")',
            f"{name} section handler",
        )
    bindings_path.write_text(bindings, encoding="utf-8")

    globals_path = Path("src/app/globals.css")
    globals_css = globals_path.read_text(encoding="utf-8")
    globals_css = replace_unless_present(
        globals_css,
        "    border-top: 1px solid #d6dce5;",
        "    border-top: 1px solid var(--border);",
        "    border-top: 1px solid var(--border);",
        "print provenance border token",
    )
    globals_css = replace_unless_present(
        globals_css,
        "    color: #5b6472;",
        "    color: var(--text-muted);",
        "    color: var(--text-muted);",
        "print provenance text token",
    )
    globals_path.write_text(globals_css, encoding="utf-8")

    universal_path = Path("tests/ui-universal-search.spec.ts")
    universal = universal_path.read_text(encoding="utf-8")
    grouped_start = universal.find('  test("selecting a grouped result navigates to the record"')
    grouped_end = universal.find('  test("Enter with nothing highlighted', grouped_start)
    if grouped_start < 0 or grouped_end < 0:
        raise RuntimeError("grouped universal-search test markers missing")
    grouped = universal[grouped_start:grouped_end]
    if "await expect(option).toBeInViewport();" not in grouped:
        grouped = replace_once(
            grouped,
            "    await expect(option).toBeVisible();\n    await option.click();",
            "    await expect(option).toBeVisible();\n"
            "    await expect(option).toBeInViewport();\n"
            "    await option.click();",
            "grouped search viewport assertion",
        )
        universal = universal[:grouped_start] + grouped + universal[grouped_end:]
    universal_path.write_text(universal, encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: pr1992-reconcile.py <resolve-conflicts|add-tests|apply-fixes>")
    phase = sys.argv[1]
    phases = {
        "resolve-conflicts": resolve_conflicts,
        "add-tests": add_tests,
        "apply-fixes": apply_fixes,
    }
    try:
        action = phases[phase]
    except KeyError as exc:
        raise SystemExit(f"unknown phase: {phase}") from exc
    action()


if __name__ == "__main__":
    main()
