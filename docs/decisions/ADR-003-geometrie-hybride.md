# ADR-003 — Géométrie 3D : procédural paramétrique + assets Blender

**Statut :** accepté (amende le PLAN §2 ADR-003)

**Contexte.** Blender 5.2 est disponible et scriptable (bpy en ligne de commande). Le rendu des pièces détaillées (fond bombé, soudures, brides, moteur) est bien meilleur en modélisation dédiée, mais les pièces dont les proportions pilotent la physique doivent rester paramétriques.

**Décision.** Hybride. Blender (scripts versionnés dans `tools/blender/`, export .glb Draco dans `public/models/`) pour les pièces statiques détaillées. Procédural (Three.js, piloté par `geometry.ts`) pour l'agitateur, les chicanes, la coupe, le fluide. Chaque pièce .glb a un fallback procédural.

**Conséquences.** Les assets sont reproductibles depuis les scripts. Le build ne dépend pas de Blender.

## Mise en œuvre (Sprint 3)

- `src/simulation/geometry.ts` : proportions normalisées par D (Paul et al., _Handbook of Industrial Mixing_), disposition des buses. `pnpm geometry:export` écrit `tools/blender/geometry.json`, dont la synchronisation est vérifiée par un test Vitest.
- `tools/blender/build_reactor_assets.py` (Blender 5.2, `bpy` en ligne de commande) produit `public/models/reactor-details.glb` (≈ 73 Ko, Draco) : réducteur-moteur, brides et boulons, buses, tuyauterie à coudes arrondis, soupape, jambes, points d'ancrage `Anchor_*`.
- Les pièces dont la physique ou l'animation dépendent du code restent procédurales : cuve et enveloppe (coupe animée par `discard` dans un coin d'angle variable, sans reconstruire de géométrie), chicanes, agitateur (rotation pilotée par le rpm), fluide (shaders au Sprint 4).
- Repli : si le `.glb` est indisponible, `ReactorDetails` affiche une version procédurale minimale.
- Gaussian Splatting et MCP Blender n'ont pas été retenus : le splatting n'est pas adapté à des surfaces animées/coupées, et un script `bpy` versionné est reproductible en CI sans session Blender interactive.
