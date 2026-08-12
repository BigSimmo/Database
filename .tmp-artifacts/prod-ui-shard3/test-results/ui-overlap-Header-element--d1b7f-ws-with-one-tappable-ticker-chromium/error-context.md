# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-overlap.spec.ts >> Header element overlap coverage >> phone smart search replaces desktop rows with one tappable ticker
- Location: tests/ui-overlap.spec.ts:269:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('smart-search-phone-ticker')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByTestId('smart-search-phone-ticker')

```

```yaml
- link "Skip to main content":
  - /url: "#main-content"
- alert
- banner:
  - button "Open Clinical Guide menu"
  - button "Mode Answer": Answer
  - button "Start a new chat"
- main:
  - heading "Clinical Guide" [level=1]
  - heading "Answer" [level=2]
  - region "What can I help with?":
    - heading "What can I help with?" [level=2]
    - paragraph: Ask a source-backed clinical question.
  - button "Open answer options"
  - combobox "Search indexed guidelines by question or keyword - Ask a source-backed clinical question"
  - button "Generate source-backed answer" [disabled]: Ask
  - note:
    - text: Do not enter patient-identifiable information.
    - link "Privacy and data processing":
      - /url: /privacy
```

# Test source

```ts
  178 |         const leftInset = menuBox!.x;
  179 |         const rightInset = viewport.width - (newChatBox!.x + newChatBox!.width);
  180 |         // 1rem header pad (~16px) with 2px subpixel tolerance.
  181 |         expect(leftInset, "left menu inset should be at least ~1rem").toBeGreaterThanOrEqual(14);
  182 |         expect(rightInset, "right new-chat inset should be at least ~1rem").toBeGreaterThanOrEqual(14);
  183 |         expect(
  184 |           Math.abs(leftInset - rightInset),
  185 |           `left/right insets should match (left=${leftInset}, right=${rightInset})`,
  186 |         ).toBeLessThanOrEqual(2);
  187 |       }).toPass({ timeout: 15_000 });
  188 |     });
  189 |   }
  190 | 
  191 |   for (const viewport of [
  192 |     { name: "mobile", width: 390, height: 820 },
  193 |     { name: "desktop", width: 1280, height: 900 },
  194 |   ] as const) {
  195 |     test(`composer clear button does not cover typed text at ${viewport.name}`, async ({ page }) => {
  196 |       await page.setViewportSize({ width: viewport.width, height: viewport.height });
  197 |       await mockDemoDashboard(page);
  198 |       await gotoHome(page);
  199 | 
  200 |       const input = page.locator('[data-testid="global-search-input"]:visible').first();
  201 |       await expect(input).toBeEditable();
  202 |       await expect(async () => {
  203 |         await input.click();
  204 |         await input.fill("Synthetic lithium monitoring guidance question");
  205 |         await expect(input).toHaveValue("Synthetic lithium monitoring guidance question");
  206 |         await expect(page.locator('[aria-label="Clear search question"]:visible').first()).toBeVisible();
  207 |       }).toPass({ timeout: 15_000 });
  208 | 
  209 |       const geometry = await page.evaluate(() => {
  210 |         const inputElement = document.querySelector('[data-testid="global-search-input"]');
  211 |         const clearElement = document.querySelector('[aria-label="Clear search question"]');
  212 |         if (!inputElement || !clearElement) return null;
  213 |         const inputRect = inputElement.getBoundingClientRect();
  214 |         const clearRect = clearElement.getBoundingClientRect();
  215 |         return { inputRight: inputRect.right, clearLeft: clearRect.left };
  216 |       });
  217 | 
  218 |       expect(geometry, "input and clear button must both render").not.toBeNull();
  219 |       expect(
  220 |         geometry!.inputRight,
  221 |         "the input must end before the clear button starts (no text under the button)",
  222 |       ).toBeLessThanOrEqual(geometry!.clearLeft + 1);
  223 |     });
  224 |   }
  225 | 
  226 |   test("desktop smart search keeps rotating text above and prompts below the composer", async ({ page }) => {
  227 |     await page.setViewportSize({ width: 1280, height: 900 });
  228 |     await mockDemoDashboard(page);
  229 |     await gotoHome(page);
  230 | 
  231 |     const rotatingText = page.getByTestId("smart-search-rotating-text");
  232 |     const promptRow = page.getByTestId("smart-search-prompt-row");
  233 |     await expect(rotatingText).toBeVisible();
  234 |     await expect(rotatingText).toContainText("Smart search");
  235 |     await expect(promptRow).toBeVisible();
  236 |     await expect(promptRow.getByRole("button", { name: "lithium level timing" })).toBeVisible();
  237 |     await expect(promptRow.getByRole("button", { name: "clozapine ANC monitoring" })).toBeVisible();
  238 | 
  239 |     const geometry = await page.evaluate(() => {
  240 |       const hint = document.querySelector('[data-testid="smart-search-rotating-text"]');
  241 |       const prompt = document.querySelector('[data-testid="smart-search-prompt-row"]');
  242 |       const pill = document.querySelector(".answer-footer-search-pill");
  243 |       if (!hint || !prompt || !pill) return null;
  244 |       const hintRect = hint.getBoundingClientRect();
  245 |       const promptRect = prompt.getBoundingClientRect();
  246 |       const pillRect = pill.getBoundingClientRect();
  247 |       return {
  248 |         hintBottom: hintRect.bottom,
  249 |         pillTop: pillRect.top,
  250 |         pillBottom: pillRect.bottom,
  251 |         promptTop: promptRect.top,
  252 |       };
  253 |     });
  254 | 
  255 |     expect(geometry, "smart search hint, composer, and prompt row must render").not.toBeNull();
  256 |     expect(geometry!.hintBottom, "rotating text should sit above the smart search bar").toBeLessThanOrEqual(
  257 |       geometry!.pillTop + 1,
  258 |     );
  259 |     expect(geometry!.promptTop, "smart prompts should sit below the smart search bar").toBeGreaterThanOrEqual(
  260 |       geometry!.pillBottom - 1,
  261 |     );
  262 | 
  263 |     await promptRow.getByRole("button", { name: "lithium level timing" }).click();
  264 |     await expect(page.locator('[data-testid="global-search-input"]:visible').first()).toHaveValue(
  265 |       "lithium level timing",
  266 |     );
  267 |   });
  268 | 
  269 |   test("phone smart search replaces desktop rows with one tappable ticker", async ({ page }) => {
  270 |     await page.setViewportSize({ width: 390, height: 820 });
  271 |     await mockDemoDashboard(page);
  272 |     await gotoHome(page);
  273 | 
  274 |     await expect(page.getByTestId("smart-search-rotating-text")).toBeHidden();
  275 |     await expect(page.getByTestId("smart-search-prompt-row")).toBeHidden();
  276 | 
  277 |     const ticker = page.getByTestId("smart-search-phone-ticker");
> 278 |     await expect(ticker).toBeVisible();
      |                          ^ Error: expect(locator).toBeVisible() failed
  279 |     await expect(ticker).toContainText("Try this");
  280 |     await expect(ticker).toContainText("Tap to search");
  281 | 
  282 |     const tickerBox = await ticker.boundingBox();
  283 |     expect(tickerBox, "phone suggestion ticker must render").not.toBeNull();
  284 |     expect(tickerBox!.height, "phone ticker must meet the tap-target floor").toBeGreaterThanOrEqual(48);
  285 | 
  286 |     const suggestion = (await ticker.getAttribute("aria-label"))?.replace("Try suggested search: ", "");
  287 |     expect(suggestion).toBeTruthy();
  288 |     await ticker.click();
  289 |     await expect(page.locator('[data-testid="global-search-input"]:visible').first()).toHaveValue(suggestion ?? "");
  290 |   });
  291 | });
  292 | 
```