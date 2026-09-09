import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const file = process.argv[2];
// A probe that prints FAIL and exits 0 is a probe that reports a regression as a
// pass to anything reading its exit status, which is how a green report gets
// written over a red run. Every verdict goes through say(), and the process
// exits nonzero if any of them is false.
let ok = true;
const say = (pass, name, detail) => {
  ok = ok && pass;
  console.log((pass ? "PASS" : "FAIL") + "  " + name + "  " + detail);
};
const url = "file://" + process.cwd() + "/" + file;

// 1 · rendered text: no em dash, no arrow, no semicolon as punctuation
let p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.goto(url, { waitUntil: "load" });
await p.waitForTimeout(700);
const text = await p.evaluate(() => {
  const bad = [];
  // Script and style contents are source, not rendered text.
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement && /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(n.parentElement.tagName)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  let n;
  while ((n = w.nextNode())) {
    const t = n.textContent;
    if (!t.trim()) continue;
    if (/[—–]/.test(t)) bad.push(["dash", t.trim().slice(0, 70)]);
    if (/[→←↑↓↔⇒➜►▸]/.test(t)) bad.push(["arrow", t.trim().slice(0, 70)]);
    if (/;/.test(t)) bad.push(["semicolon", t.trim().slice(0, 70)]);
  }
  return bad;
});
say(
  text.length === 0,
  "punctuation",
  text.length ? JSON.stringify(text.slice(0, 8)) : "no em dash, en dash, arrow or semicolon in rendered text",
);

// 2 · every control at a true 390px layout is at least 48px tall
await p.close();
p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await p.goto(url, { waitUntil: "load" });
await p.waitForTimeout(700);
const taps = await p.evaluate(() => {
  const sel = "button, summary, a[href], input, select, [role=button]";
  const bad = [];
  document.querySelectorAll(sel).forEach((e) => {
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    // A field wrapped in a label is tapped by the label, so the label is the control.
    const target = e.tagName === "INPUT" && e.closest("label") ? e.closest("label") : e;
    const r = target.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (r.height < 47.5)
      bad.push([
        target.className || target.tagName,
        +r.height.toFixed(1),
        (target.textContent || "").trim().slice(0, 28),
      ]);
  });
  return bad;
});
say(
  taps.length === 0,
  "tap floor 390px",
  taps.length ? JSON.stringify(taps.slice(0, 10)) : "every visible control is at least 48px tall",
);

// 3 · print: the ink and hairline tokens take their light values on all three roots
await p.close();
p = await b.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
await p.goto(url, { waitUntil: "load" });
await p.waitForTimeout(500);
await p.emulateMedia({ media: "print" });
const printed = await p.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const g = (n) => cs.getPropertyValue(n).trim();
  return { ink: g("--ink"), line: g("--line"), lineStrong: g("--line-strong"), surface: g("--surface") };
});
const wantInk = "#161a20";
say(printed.ink.toLowerCase() === wantInk, "print tokens", JSON.stringify(printed));
await b.close();
if (!ok) {
  console.log("SOME PROBES FAILED");
  process.exitCode = 1;
}
