import { expect, test } from '@playwright/test';

test.describe('/debug — moteur dans un Web Worker (build de production)', () => {
  test('le worker répond et le moteur démarre', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/debug');
    await expect(page.getByTestId('worker-status')).toContainText('OK');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByTestId('engine-status')).toContainText('running');
    expect(errors).toEqual([]);
  });

  test('cadence des snapshots 55–65 Hz (S2-L10)', async ({ page }) => {
    await page.goto('/debug');
    await expect(page.getByTestId('worker-status')).toContainText('OK');
    await page.getByRole('button', { name: 'Start' }).click();
    await page.waitForTimeout(500);
    const hz = await page.evaluate(async () => {
      const dbg = (window as unknown as { __cstrDebug: { simVersion: { current: number } } })
        .__cstrDebug;
      const v0 = dbg.simVersion.current;
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 3000));
      return ((dbg.simVersion.current - v0) / (performance.now() - t0)) * 1000;
    });
    expect(hz).toBeGreaterThan(45); // 55–65 Hz visé ; marge pour les runners CI partagés
    expect(hz).toBeLessThan(75);
  });

  test('panne de pompe sans quench ⇒ alarme HH puis rupture', async ({ page }) => {
    await page.goto('/debug');
    await expect(page.getByTestId('worker-status')).toContainText('OK');
    await page.getByRole('button', { name: 'Panne de la pompe de refroidissement' }).click();
    await page.getByRole('button', { name: '60', exact: true }).click();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByTestId('rupture-banner')).toContainText('Rupture', { timeout: 30_000 });
    await expect(page.getByTestId('engine-status')).toContainText('ruptured');
    await expect(page.getByText(/HH ▲/)).toBeVisible();
  });

  test('S5-L12 (version debug) : quench à l’alarme HH ⇒ pas de rupture', async ({ page }) => {
    await page.goto('/debug');
    await expect(page.getByTestId('worker-status')).toContainText('OK');
    await page.getByRole('button', { name: 'Panne de la pompe de refroidissement' }).click();
    await page.getByRole('button', { name: '10', exact: true }).click();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByText(/HH ▲/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Quench', exact: true }).click();
    await page.waitForTimeout(6000);
    await expect(page.getByTestId('engine-status')).not.toContainText('ruptured');
    await expect(page.getByTestId('rupture-banner')).toHaveCount(0);
    await expect(page.getByTestId('error-banner')).toHaveCount(0);
  });
});
