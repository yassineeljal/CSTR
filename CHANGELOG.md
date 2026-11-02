# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) · Versionnage sémantique.

## [Non publié]

### Ajouté

- **Sprint 0** — fondations : Next.js (App Router), TypeScript strict, Tailwind, Vitest, Playwright, CI GitHub Actions, ADR 001–005.
- **Sprint 1** — modèle validé : types, constantes, presets (Seborg, oxyde de propylène), protocole `postMessage`, store Zustand, worker, `units.ts`, notebooks 01–02, `docs/model.md`.
- **Sprint 2** — moteur et PID : `kinetics`, `equations`, `rk4` (sous-découpage adaptatif), `pid` (anti-windup, bumpless), `relief`, `engine`, `scenarios`; tests golden TS ↔ SciPy (erreur relative < 3·10⁻⁸); worker réel (≈ 60 Hz); page `/debug`; notebooks 03–04.

- **Sprint 3** — scène 3D : géométrie normalisée (`geometry.ts`, source unique pour Three.js et Blender), cuve/enveloppe/chicanes/agitateur/fluide procéduraux avec coupe animée par découpe en coin (shader), pièces détaillées modélisées sous Blender (`tools/blender/`, .glb Draco 73 Ko), rampe de couleur thermique partagée JS/GLSL, studio lumineux procédural (aucun HDRI), `leva` réservé au dev, budget de rendu vérifié en e2e.

- **Sprint 4** — shaders et effets : fluide (vortex ∝ rpm², ondulation d'ébullition, rampe thermique, émission > 1 au-delà de ~400 K), film d'enveloppe animé (bandes ∝ F_c, figées en panne de pompe), bulles instanciées (≤ 2000, GPU), panache de vapeur, vibration ∝ (T − T_HH)⁺, Bloom + vignette + ACES, écran de rupture, liens directs `/?scenario=…&speed=…&autostart=1`.

- **Sprint 5** — poste de contrôle SCADA : commandes procédé (T, C_A, F, RPM, pompe, vanne d'alimentation), PID (Auto/Manuel sans à-coup, gains, consigne), quench en deux temps, mesures 10 Hz colorées par niveau d'alarme, 4 courbes uPlot (tampon préalloué, 30 Hz max), alarmes ISA-18.2 (acquittement, retour à la normale non acquitté), journal, 4 scénarios, presets localStorage + export/import JSON validés, raccourcis clavier, e2e du parcours complet (scénario 2 → HH → quench → pas de rupture).

### Modifié (écarts par rapport au plan, voir `docs/model.md` §2)

- Capacité thermique de paroi `C_w`, enveloppe redimensionnée (V_j = 5 L, T_c,in = 278 K), seuils H/HH = 365/380 K, quench avec arrêt d'alimentation, soupape sous-dimensionnée.
