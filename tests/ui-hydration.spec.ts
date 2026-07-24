import { test, expect } from "@playwright/test";

test.describe("React Hydration Safety", () => {
  test("dashboard does not emit hydration warnings during initial load", async ({ page }) => {
    const hydrationErrors: string[] = [];
    
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        const text = msg.text();
        // React hydration warning signatures
        if (
          text.includes("Warning: Text content did not match") ||
          text.includes("Warning: Expected server HTML to contain") ||
          (text.includes("Warning: Prop") && text.includes("did not match")) ||
          text.includes("Hydration failed because") ||
          text.includes("There was an error while hydrating")
        ) {
          hydrationErrors.push(text);
        }
      }
    });

    // Navigate to the dashboard, ensuring we load it from the server
    await page.goto("/");
    
    // Wait for the hydration and initial load to finish
    await page.waitForLoadState("networkidle");

    // Fail the test if any hydration errors were captured
    expect(hydrationErrors, "Expected no React hydration mismatch warnings or errors in the console").toEqual([]);
  });
});
