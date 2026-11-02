# ADR-005 — Zustand en « transient updates » + buffers mutables

**Statut :** accepté

**Décision.** L'état physique 60 Hz vit dans un objet mutable hors React (`simRef`). Zustand ne stocke que l'état lent (paramètres, mode, scénario, alarmes). Les composants 3D lisent dans `useFrame`, les graphes dans leur propre rAF.
