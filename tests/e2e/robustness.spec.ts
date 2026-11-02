import { expect, test } from '@playwright/test';

test('WebGL indisponible : message clair, mode 2D (commandes et courbes fonctionnent)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      id: string,
      ...args: unknown[]
    ) {
      if (id === 'webgl' || id === 'webgl2' || id === 'experimental-webgl') return null;
      return (original as (...a: unknown[]) => unknown).call(this, id, ...args);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.getByTestId('scene-unavailable')).toBeVisible();
  await expect(page.getByTestId('scene-unavailable')).toContainText('Mode 2D');
  // le simulateur reste pilotable et les graphes se dessinent
  await page.getByTestId('run-toggle').click();
  await expect(page.getByTestId('engine-status')).toContainText('EN COURS');
  await expect(page.getByTestId('chart-temperature').locator('canvas')).toHaveCount(1);
  await expect(page.getByTestId('rupture-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('onglet masqué : pause automatique, reprise au retour (S7-L04)', async ({ page }) => {
  await page.goto('/?autostart=1&speed=10');
  await expect(page.getByTestId('engine-status')).toContainText('EN COURS');
  const setHidden = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await setHidden(true);
  await expect(page.getByTestId('engine-status')).toContainText('PAUSE');
  await setHidden(false);
  await expect(page.getByTestId('engine-status')).toContainText('EN COURS');

  // une pause posée par l'utilisateur n'est jamais relancée automatiquement
  await page.getByTestId('run-toggle').click();
  await expect(page.getByTestId('engine-status')).toContainText('PAUSE');
  await setHidden(true);
  await setHidden(false);
  await expect(page.getByTestId('engine-status')).toContainText('PAUSE');
});

test('option « pause auto » désactivée : la simulation continue en arrière-plan', async ({
  page,
}) => {
  await page.goto('/?autostart=1');
  await expect(page.getByTestId('engine-status')).toContainText('EN COURS');
  await page.getByTestId('autopause-toggle').click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(500);
  await expect(page.getByTestId('engine-status')).toContainText('EN COURS');
});
