# ADR-006 — Rendu 3D « à la demande »

**Statut :** accepté

**Contexte.** Le rendu continu à 60 Hz coûte autant au repos qu'en simulation : le profilage Lighthouse sous WebGL logiciel montrait un Total Blocking Time de 6,2 s alors que la simulation était arrêtée. Or la scène ne change que si l'état change : snapshot du moteur, interaction caméra, bascule d'un réglage.

**Décision.** `<Canvas frameloop="demand">` + `FrameDriver` : une image est produite à chaque snapshot du moteur (`subscribeSnapshots`) ou à chaque modification de l'état lent (store Zustand). `OrbitControls` invalide lui-même ; l'animation d'ouverture de la coupe entretient la boucle jusqu'à sa cible.

**Conséquences.**

- Coût CPU/GPU nul au repos (vérifié en e2e : ≤ 3 images en 2,5 s sans simulation).
- Simulation en pause ⇒ scène figée, y compris bulles et vapeur : acceptable et attendu.
- Toute nouvelle animation temporelle doit appeler `invalidate()` tant qu'elle n'est pas terminée.
- La qualité adaptative (ADR-007) ne mesure la cadence que pendant les images produites.
