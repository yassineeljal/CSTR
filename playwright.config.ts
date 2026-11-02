import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
// PERF_GPU=1 : GPU réel (Metal/ANGLE) pour l'audit de performance local ; sinon SwiftShader
const GPU = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const SOFTWARE_GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

export default defineConfig({
  testDir: './tests/e2e',
  // WebGL logiciel (SwiftShader) : les tests 3D sont lents ; marge pour les runners partagés
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: process.env.CI ? 2 : 3,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  // Deux familles de tests :
  //  - `ui`  : poste de contrôle complet, WebGL désactivé (le repli 2D de l'application s'active) →
  //            rapide et déterministe, y compris sur les runners CI sans GPU ;
  //  - `3d`  : scène, captures, perf, inspection (rendu WebGL réel, lent en logiciel) ;
  //  - `smoke3d` : un test de fumée 3D léger, exécuté aussi en CI.
  projects: [
    {
      name: 'ui',
      testMatch: /(home|debug|scada|robustness)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-3d-apis'] } },
    },
    {
      name: 'smoke3d',
      testMatch: /smoke3d\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], launchOptions: { args: SOFTWARE_GL } },
    },
    {
      name: '3d',
      testMatch: /(scene|visuals|hud|perf|robustness3d|screenshots)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: process.env.PERF_GPU ? GPU : SOFTWARE_GL },
      },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
