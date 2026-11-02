import { expect, test, type Page } from '@playwright/test';

/**
 * Fumée de performance (PLAN §8.1) et fuite mémoire GPU (S7-L01).
 * Durée réglable : PERF_SOAK_SECONDS (20 s par défaut en CI ; 600 s pour l'audit complet de 10 min).
 * Sans PERF_GPU, WebGL logiciel (SwiftShader) : seuils indicatifs, très en deçà d'un GPU réel.
 */
const SOAK_SECONDS = Number(process.env.PERF_SOAK_SECONDS ?? 20);

const stats = (page: Page) =>
  page.evaluate(() => {
    const d = document.documentElement.dataset;
    return {
      frames: Number(d.frames),
      geometries: Number(d.geometries),
      textures: Number(d.textures),
      calls: Number(d.drawCalls),
      triangles: Number(d.triangles),
      quality: d.quality,
    };
  });

test('fumée de performance et stabilité mémoire GPU', async ({ page }) => {
  test.setTimeout((SOAK_SECONDS + 60) * 1000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?scenario=cold-start&speed=10&autostart=1');
  await expect(page.locator('html[data-scene="ready"]')).toBeAttached({ timeout: 30_000 });
  await page.waitForTimeout(4000); // échauffement : shaders, .glb, premiers rendus

  const start = await stats(page);
  const samples: Awaited<ReturnType<typeof stats>>[] = [];
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < SOAK_SECONDS) {
    await page.waitForTimeout(Math.min(5000, SOAK_SECONDS * 1000));
    samples.push(await stats(page));
  }
  const end = samples.at(-1) ?? start;
  const fps = (end.frames - start.frames) / ((Date.now() - t0) / 1000);
  console.log(
    `PERF fps≈${fps.toFixed(1)} draw=${end.calls} tris=${end.triangles} geom=${start.geometries}→${end.geometries} tex=${start.textures}→${end.textures} qualité=${end.quality}`,
  );

  // pas de fuite : le nombre de géométries/textures est stable
  for (const s of samples) {
    expect(s.geometries).toBe(start.geometries);
    expect(s.textures).toBe(start.textures);
  }
  expect(end.calls).toBeGreaterThan(5); // garde-fou : une mesure à 1 signalerait un compteur faussé
  expect(end.calls).toBeLessThan(100);
  expect(end.triangles).toBeLessThan(300_000);
  // GPU réel (PERF_GPU=1) : ≥ 30 FPS (PLAN §8.1) ; SwiftShader (CI) : simple garde-fou « non figé »
  expect(fps).toBeGreaterThan(process.env.PERF_GPU ? 30 : 1);
  // un GPU réel ne doit pas être dégradé par la qualité adaptative (cadence plafonnée par les snapshots)
  if (process.env.PERF_GPU) expect(end.quality).toBe('high');
});
