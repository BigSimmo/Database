# Ward Flow — third edition merge brief

This brief is the single source of truth for merging two bodies of work into one Command mockup
and one design standard. Read it in full before touching a file. Where it is silent, keep the
branch build's behaviour and our identity, in that order.

## The two sources

**Source L, "Live edition" (the branch build).** `../branch/command-premium.html` (Command,
light and dark, 227 KB) and `../branch/design-standard.html` (design standard, second edition,
378 KB). Authored on branch `claude/hospital-mockup-premium-qzq6cx`. Its strengths are content,
behaviour and rigour: a masthead figures strip counted from the data, route words on every queue
row, a one-bar stepper with a stage sentence, fills only on eligible or recorded wards, exceptions
leading the registers, stale marks, a legend disclosure, a grouped rail with derived counts and a
reconciliation line in the foot, a Light / Dark / Auto appearance control remembered per browser,
a skip link, a live region, Escape handling, measured scroll fades, a 10.5 px type floor on a
seven step scale, 35 contrast pairs computed on load, and a definition of done. Its stylesheet is
token based. Its weakness is the light theme: near white ground, white panels, solid grey
hairlines, faint separation, no tonal structure. Its type is Newsreader + IBM Plex Sans + IBM Plex
Mono, its brand Prussian blue, its secondary gilt.

**Source P, "Platinum Raised Cool" (ours).** `../wardflow-command-cool.html` (Command, light and
dark), `../wardflow-style.css` (its stylesheet, 385 lines), `../wardflow-theme-init.js`,
`../WARD-FLOW-STYLE-GUIDE.md` (the first edition standard as a document) and `../guide-body.html`
(the first edition standard as a page body). Its strengths are the identity and the material: cool
platinum neutrals with a faint blue cast, a deep slate brand, brass as a bar and never a fill,
teal and plum for the health services, Source Serif 4 + Source Sans 3 + JetBrains Mono, a canvas
with a fall of light, a 3 px brand stripe, alpha hairlines, a slate tinted shadow, toned header and
footer strips with inner radii, status bars that survive selection, a verification harness. Its
weaknesses are the ones Source L fixed: labels down to 8 px, a seven label stepper, pink fills on
every "needs a reason" ward, no masthead figures, no route words, a plain toggle.

## The decision

**Source L's content, behaviour, engine, data, layout and rigour. Source P's identity and
material.** In plain words: everything a coordinator reads or does comes from the branch build;
everything the eye sees as colour, type, light and surface comes from ours. Where the two
disagree on a rule, the stricter rule wins and is written down.

## Identity tokens (final, both themes)

Replace Source L's token block with these. Keep every Source L token _name_ that its stylesheet
or script reads (`--ground`, `--surface`, `--surface-2`, `--sunk`, `--ink`, `--ink-soft`,
`--muted`, `--line`, `--line-strong`, `--accent`, `--accent-ink`, `--accent-soft`, `--on-accent`,
`--gilt`, `--gilt-soft`, `--good`, `--good-soft`, `--warn`, `--warn-soft`, `--danger`,
`--danger-soft`, `--danger-ink`, `--svc-east`, `--svc-north`, `--svc-south`, `--svc-wachs`,
`--ward`, `--ward-soft`, `--ed`, `--comm`, `--coord`, `--lift`, `--hl`, `--edge-shade`, `--r1`,
`--r2`, `--gap`, `--t-0` … `--t-6`, `--display`, `--body`, `--mono`) and add ours
(`--ground-hi`, `--ground-2`, `--stripe`, `--hl-on-accent`, `--r1i`). `--gilt` is brass. Do not
rename `--gilt` to `--copper`; the merged system calls the colour brass and the token gilt.

Light (bare `:root`):

```
--ground-hi:#ECF0F4; --ground:#E6EAEF; --ground-2:#E1E6EC;
--surface:#FDFDFE; --surface-2:#F4F7FA; --sunk:#EEF2F6;
--ink:#161A20; --ink-soft:#414953; --muted:#5F6873;
--line:rgba(22,30,40,.11); --line-strong:rgba(22,30,40,.26);
--accent:#2F4C66; --accent-ink:#27405A; --accent-soft:#DFE7F0; --on-accent:#FFFFFF; --stripe:#2F4C66;
--gilt:#7D612A; --gilt-soft:#F1EBDF;
--good:#227550; --good-soft:#E2F0E8; --warn:#886211; --warn-soft:#F6EEDA;
--danger:#B03B2E; --danger-soft:#F8E6E2; --danger-ink:#973121;
--svc-east:#2F4C66; --svc-north:#6F5F9E; --svc-south:#3F7A80; --svc-wachs:#8C5A3C;
--ward:var(--svc-east); --ward-soft:var(--accent-soft); --ed:var(--danger); --comm:var(--svc-south); --coord:var(--svc-north);
--lift:0 1px 1px rgba(30,48,66,.05), 0 14px 30px -22px rgba(30,48,66,.45);
--hl:rgba(255,255,255,.9); --hl-on-accent:rgba(255,255,255,.14); --edge-shade:rgba(30,48,66,.16);
--r1:10px; --r1i:9px; --r2:6px; --gap:14px;
--t-0:10.5px; --t-1:11.5px; --t-2:12.5px; --t-3:13.5px; --t-4:16px; --t-5:20px; --t-6:26px;
--display:"Source Serif 4",Georgia,"Times New Roman",serif;
--body:"Source Sans 3","Segoe UI",system-ui,sans-serif;
--mono:"JetBrains Mono",ui-monospace,Consolas,monospace;
```

Dark (both under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }`
and under `:root[data-theme="dark"] {…}`; keep Source L's print rule that gives every token its
light value on all three roots):

```
--ground-hi:#14181D; --ground:#0F1216; --ground-2:#0C0F12;
--surface:#171B21; --surface-2:#1B2026; --sunk:#13171C;
--ink:#E8ECF1; --ink-soft:#B2BAC5; --muted:#8A929D;
--line:rgba(255,255,255,.09); --line-strong:rgba(255,255,255,.21);
--accent:#A7BCD2; --accent-ink:#BFD0E2; --accent-soft:#1F2A36; --on-accent:#0F1216; --stripe:#3A5A78;
--gilt:#D3B77E; --gilt-soft:#2A251B;
--good:#6FD39B; --good-soft:#15291F; --warn:#E3BC5E; --warn-soft:#2B2415;
--danger:#FF8B76; --danger-soft:#33201B; --danger-ink:#FFA08E;
--svc-east:#A7BCD2; --svc-north:#B1A2D6; --svc-south:#7FB2B8; --svc-wachs:#D89A78;
--lift:0 1px 1px rgba(0,0,0,.4), 0 16px 34px -22px rgba(0,0,0,.95);
--hl:rgba(255,255,255,.06); --hl-on-accent:rgba(255,255,255,.28); --edge-shade:rgba(0,0,0,.55);
```

Font link (replace Source L's):

```
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&family=Source+Sans+3:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">
```

Only weights that are loaded may be asked for: serif 600 and 700, sans 400 to 700, mono 400 to 600. Replace any `font-weight: 800` or `500` on the serif with the nearest loaded weight.

## Material rules to apply to Source L's stylesheet

Apply these on top of Source L's stylesheet. Change the rule, not the class name, so its script
keeps working.

1. **Canvas.** `body { background: linear-gradient(180deg, var(--ground-hi) 0%, var(--ground) 55%, var(--ground-2) 100%) fixed, var(--ground); }`. Add `text-rendering: optimizeLegibility; font-optical-sizing: auto;`.
2. **Brand stripe.** `body::before { content:""; position:fixed; top:0; left:0; right:0; height:3px; background:var(--stripe); z-index:20; pointer-events:none; }`. Hidden in print. `CanvasText` under forced colours.
3. **Panel.** `border:1px solid var(--line); border-bottom-color:var(--line-strong); border-radius:var(--r1); box-shadow:var(--lift), inset 0 1px 0 var(--hl);`. One elevation step and only one. Nothing inside a panel carries a shadow.
4. **Strips.** The panel header strip, the legend or diagram foot, and the tab bar sit on `var(--surface-2)`. A strip that touches a panel corner takes `var(--r1i)` on those corners.
5. **Hairlines** are the alpha tokens above. Remove any solid grey used as a line.
6. **Brass is a bar, never a fill.** Where Source L uses `--gilt` for "you are here" keep it (active nav item bar, live tab bar, selected row bar, current stage). Where it uses `--gilt-soft` as a fill behind text, change to a bar or an outline plus text in `--gilt`. The two letters beside the wordmark stay brass. The prototype chip stays neutral, as Source L has it.
7. **Selection never hides status.** A pressed pressure card and a showing candidate keep their status bar and gain a slate ring (`inset 0 0 0 1px var(--accent)`) on the other three sides over `var(--accent-soft)`. Check Source L's rules for `.edCard[aria-pressed="true"]` and `.cand[data-showing="true"]` and correct them if they overwrite the bar.
8. **Buttons.** Secondary: `var(--surface)`, 1px `var(--line-strong)`, radius `var(--r2)`, hover `var(--sunk)` with an ink-soft border. Primary: `var(--accent)` fill, `var(--on-accent)` text, `inset 0 1px 0 var(--hl-on-accent)`, hover and press to `var(--accent-ink)`. Never brighten on hover.
9. **Count pills** on the rail and tabs: mono on `var(--sunk)` with a hairline ring; selected on `var(--accent-soft)` with a slate ring. A zero is italic with no pill.
10. **Scrollbars** thin, `var(--line-strong)` thumb, transparent track, in every scrolling region.
11. **Panel titles** in `var(--accent-ink)`, display serif. Brand name in `var(--accent-ink)`.
12. **Keep Source L's** scroll fades (re-tint `--edge-shade` as above), legend disclosure, skip link, live region, Escape handling, appearance control and its storage, masthead figures, route words, stepper bar and stage sentence, stale marks, exceptions first, derived rail counts, reconciliation line, the 10.5 px floor and the seven step scale, and every data and reconcile behaviour.
13. **Keep Source L's** diagram fill rule: only an eligible or a recorded ward carries a fill; every other verdict is an outline and a word. Re-point its colours at the tokens above.
14. **Keep our** breakpoints where Source L lacks one: the laptop rule at `(min-width:1400px) and (max-height:960px)` that shortens the registers panel and tightens the strip so the diagram keeps its height. Source L may already handle this; verify at 1440 by 900 that the diagram region is at least 260 px tall and add the rule only if it is not.

## Type rules

- Display serif for the wordmark, page title, panel titles, site codes and diagram headings.
  Body sans for everything read. Mono for every figure and identifier. Tabular numerals on the
  whole page.
- Floor 10.5 px, scale `--t-0` to `--t-6`, nothing between steps. Uppercase labels carry .08 to
  .12 em of tracking. No small capitals.
- Headings: serif 600; page title `--t-6`; panel title `--t-3`; masthead figures mono `--t-5`.

## Verification (both artifacts)

Run `node docs/ward-flow/mockups/third-edition-kit/check.mjs <file> platinum` from the repository
root and iterate until every line reports green. The file path is given relative to the root. Fonts
are served from `third-edition-kit/fonts`, so the run is offline; if that directory is removed the
harness falls back to the live stylesheet and says which mode it used. It checks fonts, page errors, reconcile, horizontal overflow at five
widths, the type floor, contrast on every visible text element in both themes, diagram height at
1440 by 900, the appearance control's first click from a dark machine, and keyboard focus. Then
run `node docs/ward-flow/mockups/third-edition-kit/shots.mjs <file> <outprefix> platinum` for the
screenshots. Paste the check
output into your report; a claim without the output is not a pass.

## Naming

- Mockup: `merged/command-third-edition.html`, `<title>Ward Flow Command</title>`.
- Standard: `merged/design-system-third-edition.html`, `<title>Ward Flow Design System</title>`;
  its own class names are prefixed `g-`; every component example uses the mockup's class names
  and is drawn by the mockup's stylesheet, never by a copy.
- Standard as a document: `merged/WARD-FLOW-DESIGN-SYSTEM.md`.
- The edition is called the **third edition**. The first was Platinum Raised Cool, the second
  the Live edition standard. Say so once, in the standard's opening, and keep the departures
  table so a reader of either earlier edition can see what moved.

## Style of writing inside the artifacts

Plain sentences. No em dashes, no semicolons, no arrows, no emoji. Australian spelling. Every
figure and every name invented, and each page says so. A rule is stated once, with its reason.
