// Builds shell/preview.html: the mockup's full <style> block copied in, then shell.css, the third
// edition font link, shell-markup.html with a stub in place of the Command body, the preview's
// engine stub and shell-script.js. Run from the repository root:
//   node docs/ward-flow/mockups/third-edition-kit/shell/build-preview.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const here = path.dirname(fileURLToPath(import.meta.url));
const mockup = fs.readFileSync(path.join(here, "../../command-third-edition.html"), "utf8");
const style = mockup.slice(mockup.indexOf("<style>"), mockup.indexOf("</style>") + "</style>".length);
const shellCss = fs.readFileSync(path.join(here, "shell.css"), "utf8");
const markup = fs.readFileSync(path.join(here, "shell-markup.html"), "utf8");
const stubBody = `
      <section class="panel" aria-label="About this preview">
        <div class="ph">
          <h2>Shell preview</h2>
          <p class="note" style="margin-left: 12px">
            The header and the rail over a stand in body. The Command body goes here in the graft.
          </p>
          <span class="count" id="previewDiagNote"></span>
        </div>
      </section>
      <section class="panel qPanel" aria-label="Priority queue">
        <div class="ph">
          <h2 id="qHeading">Priority queue</h2>
          <span class="count" id="qCount"></span>
        </div>
        <div id="qFilter"></div>
        <div class="qList" id="qpane-patients" role="region" aria-label="Open movements" tabindex="0"></div>
      </section>`;
const bodyStart = markup.indexOf("<!-- THE COMMAND BODY GOES HERE");
const bodyEnd = markup.indexOf("-->", bodyStart) + 3;
const withStub = markup.slice(0, bodyStart) + stubBody.trim() + markup.slice(bodyEnd);
const html = `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ward Flow Shell</title>
    <script>
      /* Runs before the stylesheet: stamps the remembered appearance and the remembered rail state
         on the root so the first paint is already right, with no width jump. */
      (function () {
        try {
          var v = localStorage.getItem("ward-flow-command-appearance");
          if (v === "light" || v === "dark") document.documentElement.setAttribute("data-theme", v);
          if (localStorage.getItem("ward-flow-rail") === "closed") document.documentElement.setAttribute("data-rail", "closed");
        } catch (e) {}
      })();
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&family=Source+Sans+3:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
    />
    <!-- The mockup's full stylesheet, copied in by build-preview.mjs. Never edited here. -->
${style}
    <!-- The shell's rules, copied in by build-preview.mjs from shell.css. -->
    <style>
${shellCss}
    </style>
  </head>
  <body>
${withStub}
    <script src="preview-stub.js"></script>
    <script src="shell-script.js"></script>
  </body>
</html>
`;
fs.writeFileSync(path.join(here, "preview.html"), html);
console.log("wrote", path.join(here, "preview.html"), html.length, "bytes");
