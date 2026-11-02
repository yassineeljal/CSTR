import { expect, test, type Page } from '@playwright/test';

/**
 * Génère les captures du README et l'image de partage Open Graph.
 * Désactivé par défaut : `SCREENSHOTS=1 PERF_GPU=1 pnpm exec playwright test screenshots`.
 */
test.skip(!process.env.SCREENSHOTS, 'captures : définir SCREENSHOTS=1');

const T = (page: Page) =>
  page.evaluate(() => Number(document.documentElement.dataset.simTemp ?? '0'));

test('captures du README et image Open Graph', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 960 });

  // 1. poste de contrôle, régime nominal
  await page.goto('/?scenario=pump-failure&speed=1');
  await expect(page.locator('html[data-scene="ready"]')).toBeAttached({ timeout: 30_000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'docs/screenshots/01-control-room.png' });

  // 2. emballement : alarmes, vapeur, fluide incandescent
  await page.goto('/?scenario=pump-failure&speed=10&autostart=1');
  await expect(page.locator('html[data-scene="ready"]')).toBeAttached({ timeout: 30_000 });
  await expect.poll(() => T(page), { timeout: 90_000, intervals: [500] }).toBeGreaterThan(400);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/screenshots/02-runaway.png' });

  // 3. mode inspection avec la fiche ouverte
  await page.getByTestId('inspection-toggle').click();
  await expect(page.getByTestId('inspect-label-matter')).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/03-inspection.png' });
  await page.getByTestId('inspect-label-relief').getByRole('button', { name: /Fiche/ }).click();
  await expect(page.getByTestId('theory-drawer')).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/screenshots/04-theory.png' });

  // 4. image de partage : scène seule en mode kiosque (1200×630), régime nominal en coupe
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto('/?kiosk=1&scenario=cold-start&speed=60&autostart=1');
  await expect(page.locator('html[data-scene="ready"]')).toBeAttached({ timeout: 30_000 });
  await expect.poll(() => T(page), { timeout: 60_000, intervals: [500] }).toBeGreaterThan(340);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'src/app/opengraph-image.png' });
});
