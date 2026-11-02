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
