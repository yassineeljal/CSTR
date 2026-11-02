# ADR-001 — Simulation 100 % côté client dans un Web Worker

**Statut :** accepté

**Contexte.** Vercel est serverless : pas de boucle physique continue ni de WebSocket persistant.

**Décision.** Le moteur (RK4 + PID) tourne dans un Web Worker dédié en TypeScript. L'application Next.js est servie statiquement.

**Conséquences.** Latence réseau nulle, coût nul, hors ligne. Thread principal libre. Performance dépendante du client (négligeable : 2 à 4 EDO). L'abstraction `SimulationTransport` (PLAN §5.3) permet une architecture B plus tard.
