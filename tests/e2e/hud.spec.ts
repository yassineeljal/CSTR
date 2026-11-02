import { expect, test } from '@playwright/test';

test('poste de contrôle : capture du HUD complet (scénario 2 en cours)', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 960 });
  await page.goto('/?scenario=pump-failure&speed=10&autostart=1');
  await expect(page.locator('html[data-scene="ready"]')).toBeAttached({ timeout: 30_000 });
  await expect(page.getByTestId('engine-status')).toContainText('EN COURS');
  await expect
    .poll(() => page.evaluate(() => Number(document.documentElement.dataset.simTemp ?? '0')), {
      timeout: 60_000,
    })
    .toBeGreaterThan(366);
  await page.screenshot({ path: 'test-results/hud.png' });
});

test('mode inspection : étiquettes KaTeX, tiroir de théorie, Van Heerden en direct', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 960 });
  await page.goto('/?scenario=pump-failure&speed=10&autostart=1');
  await expect(page.locator('html[data-scene="ready"]')).toBeAttached({ timeout: 30_000 });
  await expect(page.getByTestId('inspect-label-matter')).toHaveCount(0);
  await page.getByTestId('inspection-toggle').click();
  await expect(page.getByTestId('inspect-label-matter')).toBeVisible();
  await expect(page.getByTestId('inspect-label-relief')).toBeVisible();
  await expect(page.getByTestId('inspect-label-matter').locator('.katex')).toHaveCount(1);
  await expect(page.getByTestId('vanheerden').locator('canvas')).toHaveCount(1);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/inspection.png' });

  // un clic sur « Fiche » ouvre la bonne fiche avec ses formules rendues
  await page.getByTestId('inspect-label-relief').getByRole('button', { name: /Fiche/ }).click();
  const drawer = page.getByTestId('theory-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('soupape');
  await expect(drawer.locator('.katex').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/theory.png' });
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);

  // « I » quitte le mode inspection
  await page.keyboard.press('i');
  await expect(page.getByTestId('inspect-label-matter')).toHaveCount(0);
});
