# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) · Versionnage sémantique.

## [Non publié]

### Ajouté

- **Sprint 0** — fondations : Next.js (App Router), TypeScript strict, Tailwind, Vitest, Playwright, CI GitHub Actions, ADR 001–005.
- **Sprint 1** — modèle validé : types, constantes, presets (Seborg, oxyde de propylène), protocole `postMessage`, store Zustand, worker, `units.ts`, notebooks 01–02, `docs/model.md`.
- **Sprint 2** — moteur et PID : `kinetics`, `equations`, `rk4` (sous-découpage adaptatif), `pid` (anti-windup, bumpless), `relief`, `engine`, `scenarios`; tests golden TS ↔ SciPy (erreur relative < 3·10⁻⁸); worker réel (≈ 60 Hz); page `/debug`; notebooks 03–04.

- **Sprint 3** — scène 3D : géométrie normalisée (`geometry.ts`, source unique pour Three.js et Blender), cuve/enveloppe/chicanes/agitateur/fluide procéduraux avec coupe animée par découpe en coin (shader), pièces détaillées modélisées sous Blender (`tools/blender/`, .glb Draco 73 Ko), rampe de couleur thermique partagée JS/GLSL, studio lumineux procédural (aucun HDRI), `leva` réservé au dev, budget de rendu vérifié en e2e.

### Modifié (écarts par rapport au plan, voir `docs/model.md` §2)

- Capacité thermique de paroi `C_w`, enveloppe redimensionnée (V_j = 5 L, T_c,in = 278 K), seuils H/HH = 365/380 K, quench avec arrêt d'alimentation, soupape sous-dimensionnée.
