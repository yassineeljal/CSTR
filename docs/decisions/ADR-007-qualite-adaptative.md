# ADR-007 — Qualité de rendu adaptative

**Statut :** accepté

**Décision.** `PerformanceMonitor` (drei) mesure la cadence réelle ; sous ≈ 50 FPS le niveau passe à « bas » : rapport de pixels 1, Bloom coupé, 4× moins de bulles et de particules de vapeur. Il remonte si la cadence se rétablit (3 bascules maximum, puis repli stable). L'utilisateur peut forcer Haute ou Basse (la mesure est alors neutralisée).

**Mesures.** GPU réel (Metal) : niveau « haut » maintenu à ≈ 54 FPS. SwiftShader (rendu logiciel) : bascule automatique sur « bas » (voir `docs/perf.md`).

**Budget de rendu.** Les ombres de contact sont statiques (`frames={1}`) : calculées en continu, elles re-rendaient toute la scène à chaque image (164 → 90 draw calls, 267 k → 134 k triangles). Le chiffre « draw calls par image » est une moyenne par image affichée, `renderer.info.autoReset` désactivé (le post-traitement le remettrait à zéro à chaque passe).
