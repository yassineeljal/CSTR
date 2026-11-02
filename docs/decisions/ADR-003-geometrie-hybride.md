# ADR-003 — Géométrie 3D : procédural paramétrique + assets Blender

**Statut :** accepté (amende le PLAN §2 ADR-003)

**Contexte.** Blender 5.2 est disponible et scriptable (bpy en ligne de commande). Le rendu des pièces détaillées (fond bombé, soudures, brides, moteur) est bien meilleur en modélisation dédiée, mais les pièces dont les proportions pilotent la physique doivent rester paramétriques.

**Décision.** Hybride. Blender (scripts versionnés dans `tools/blender/`, export .glb Draco dans `public/models/`) pour les pièces statiques détaillées. Procédural (Three.js, piloté par `geometry.ts`) pour l'agitateur, les chicanes, la coupe, le fluide. Chaque pièce .glb a un fallback procédural.

**Conséquences.** Les assets sont reproductibles depuis les scripts. Le build ne dépend pas de Blender.
