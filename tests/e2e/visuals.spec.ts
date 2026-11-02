import { expect, test } from '@playwright/test';

/**
 * Captures de l'état chaud (S4) : bloom, bulles, vapeur, vibration. Les images sont écrites dans
 * test-results/ pour revue visuelle ; le test vérifie l'absence d'erreur et le déclenchement des
 * effets (température, pas de crash de shader).
 */
test('panne de pompe : le fluide chauffe, la scène reste stable et sans erreur de shader', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?scenario=pump-failure&speed=10&autostart=1');
  await expect(page.locator('html[data-scene="ready"]')).toBeAttached({ timeout: 30_000 });

  const temp = async () =>
    Number(await page.evaluate(() => document.documentElement.dataset.simTemp ?? '0'));
  await expect.poll(temp, { timeout: 60_000, intervals: [500] }).toBeGreaterThan(372);
  await page.screenshot({ path: 'test-results/hot-370K.png' });
  await expect.poll(temp, { timeout: 60_000, intervals: [500] }).toBeGreaterThan(405);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/hot-405K.png' });

  const stats = await page.evaluate(() => ({ ...document.documentElement.dataset }));
  expect(Number(stats.drawCalls)).toBeLessThan(100);
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
});

test('rupture : écran de perte de confinement, puis « Réessayer » relance la simulation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?scenario=pump-failure&speed=60&autostart=1');
  const overlay = page.getByTestId('rupture-overlay');
  await expect(overlay).toBeVisible({ timeout: 60_000 });
  await expect(overlay).toContainText('Perte de confinement');
  await expect(overlay).toContainText(/T = 45\d\.\d K/);
  await page.screenshot({ path: 'test-results/rupture.png' });
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(overlay).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => Number(document.documentElement.dataset.simTime ?? '999')), {
      timeout: 10_000,
    })
    .toBeLessThan(150); // ×60 : le temps simulé repart de 0 (≈ 60 s par seconde réelle)
});
