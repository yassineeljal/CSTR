import { expect, test } from '@playwright/test';

/**
 * Test de fumée 3D, léger et sans capture : tourne aussi en CI, où le rendu logiciel
 * (SwiftShader, 2 vCPU) est très lent. Les tests 3D complets (captures, perf, inspection) sont
 * dans le projet `3d`, exécutés en local : `pnpm test:e2e:3d`.
 */
test('la scène 3D se monte sans erreur et respecte le budget de draw calls', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.setViewportSize({ width: 960, height: 600 });
  // simulation lancée : le rendu à la demande produit des images en continu
  await page.goto('/?kiosk=1&speed=10&autostart=1');
  await expect(page.locator('html[data-scene="ready"]')).toBeAttached({ timeout: 60_000 });
  await expect(page.getByTestId('reactor-canvas')).toBeVisible({ timeout: 60_000 });
  const read = () =>
    page.evaluate(() => ({
      frames: Number(document.documentElement.dataset.frames ?? '0'),
      draws: Number(document.documentElement.dataset.drawCalls ?? '0'),
    }));
  // régime établi : au-delà des premières images (ombres de contact calculées une fois, shaders)
  await expect
    .poll(async () => (await read()).frames, { timeout: 120_000, intervals: [1000] })
    .toBeGreaterThan(8);
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(1500);
    samples.push((await read()).draws);
  }
  const steady = [...samples].sort((a, b) => a - b)[1] as number; // médiane
  expect(steady).toBeGreaterThan(5);
  expect(steady).toBeLessThan(100);
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
});
