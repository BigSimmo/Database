import { expect, type Page } from "playwright/test";

export async function openAppModeMenu(page: Page, currentMode: string) {
  const trigger = page.getByRole("button", { name: `Mode ${currentMode}` });
  const menu = page.getByRole("menu", { name: "Choose app mode" });

  await expect(trigger).toBeVisible();
  await expect(async () => {
    if (await menu.isVisible().catch(() => false)) return;
    await trigger.click();
    await expect(menu).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 20_000 });

  return menu;
}
