# Audit de performance (S7-L01)

Toutes les valeurs ci-dessous ont été **mesurées** sur la machine de développement (Mac Apple Silicon, Chromium 156 piloté par Playwright, viewport 1280×800, scénario _Démarrage à froid_ à ×10). Méthodes reproductibles : voir « Reproduire ».

## Moteur physique (budget : < 2 ms par tick)

| Facteur                           | Coût moyen par tick de 16 ms | p99      |
| --------------------------------- | ---------------------------- | -------- |
| ×60 (96 pas RK4 + PID + snapshot) | **0,031 ms**                 | 0,090 ms |
| ×10 (défaut)                      | 0,005 ms                     | —        |

Soit ≈ 65× sous le budget : `SharedArrayBuffer` n'est pas justifié (ADR-002).

## Rendu 3D (GPU réel, Metal)

| Indicateur                 | Budget  | Mesuré                                                                                         |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| Cadence                    | 60 FPS  | **≈ 58 FPS** (plafonnée par la cadence des snapshots, ≈ 60 Hz)                                 |
| Draw calls par image       | < 100   | **90**                                                                                         |
| Triangles par image        | < 300 k | **≈ 134 k** (qualité haute), ≈ 104 k (basse)                                                   |
| Mémoire GPU sur 10 min     | stable  | **stable** : 48 géométries / 27 textures du début à la fin (soak de 10,2 min, 55,1 FPS moyens) |
| Repos (simulation arrêtée) | —       | ≤ 3 images en 2,5 s : **coût nul** (rendu à la demande, ADR-006)                               |

### Ce qui a été corrigé grâce à la mesure

- **Méthode de mesure.** Une première version lisait `renderer.info` tel quel : avec le post-traitement, chaque passe le remet à zéro, on ne voyait que la dernière passe (« 1 draw call ») puis des valeurs fausses (« < 100 ») avant fusion des géométries. La mesure actuelle désactive `autoReset` et moyenne par image affichée.
- **Ombres de contact.** Calculées en continu (`frames = ∞`), elles re-rendaient toute la scène à chaque image : **164 → 90 draw calls**, **267 k → 134 k triangles** en les rendant statiques (le réacteur est immobile).
- **Qualité adaptative.** Le seuil initial de 50 FPS était trop proche du plafond de ≈ 60 Hz imposé par les snapshots : la qualité basculait définitivement sur « basse » même avec un GPU peu chargé (observé sur le premier soak de 10 min). Bornes recalées à 45 / 54 FPS, délai de 6 s avant le premier jugement (compilation des shaders, décodage du `.glb`), plus de repli forcé.

## Rendu logiciel (SwiftShader, sans GPU)

≈ 2 à 3 images/s : la qualité adaptative bascule automatiquement sur « basse » (test e2e `robustness.spec.ts`). Le plan visait ≥ 30 FPS « en headless » : **non atteignable en rendu logiciel** ; le seuil du test CI est donc un simple garde-fou « non figé » et le seuil de 30 FPS est vérifié avec `PERF_GPU=1`.

## Lighthouse (preset desktop, GPU réel)

| Page     | Performance | Accessibilité | Bonnes pratiques | SEO     |
| -------- | ----------- | ------------- | ---------------- | ------- |
| `/`      | **100**     | **100**       | **100**          | **100** |
| `/about` | **100**     | **100**       | **100**          | **100** |

`/` : FCP 0,2 s, TBT 20 ms, CLS 0,005. Avec WebGL **logiciel** (SwiftShader) la performance tombe à ≈ 62 (TBT ≈ 1,7 s) : c'est le coût du rendu logiciel, pas du JavaScript. Le profil _mobile_ par défaut de Lighthouse (CPU ×4, 4G) n'est pas la cible de cette application (poste de contrôle bureau) ; il donne 64–67 avec les mêmes causes.

## Poids du JavaScript

- JS initial référencé par la page (gzip) : **≈ 211 kB** (cible : < 500 kB hors three). Il était de ≈ 406 kB avant le chargement différé de KaTeX, react-markdown et des fiches (téléchargés seulement à l'ouverture du mode Inspection).
- Three.js / R3F / drei : chargés après le premier affichage via `dynamic(..., { ssr: false })`.
- Assets : `.glb` Draco 52 ko, décodeur Draco local 62 ko (aucune dépendance CDN), aucun HDRI (environnement procédural).

## Reproduire

```bash
pnpm exec vitest run enginePerf --silent=false          # coût du moteur
PERF_GPU=1 PERF_SOAK_SECONDS=600 pnpm exec playwright test perf --workers=1   # soak 10 min sur GPU réel
pnpm exec playwright test perf                           # version CI (SwiftShader, 20 s)
# Lighthouse (depuis un build de production)
pnpm build && pnpm start -p 3200 &
pnpm dlx lighthouse http://localhost:3200/ --preset=desktop
```

Les statistiques de rendu sont publiées toutes les 500 ms dans `document.documentElement.dataset` (`drawCalls`, `triangles`, `geometries`, `textures`, `frames`, `quality`) par `RenderStats`.
