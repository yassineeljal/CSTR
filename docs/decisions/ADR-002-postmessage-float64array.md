# ADR-002 — Communication Worker ↔ UI par postMessage + Float64Array transférable

**Statut :** accepté

**Contexte.** `SharedArrayBuffer` impose COOP/COEP, qui cassent le chargement de ressources tierces (HDRI, polices).

**Décision.** v1 : `postMessage` d'un buffer typé à disposition fixe (`SNAPSHOT_LAYOUT`), ~60 Hz. SharedArrayBuffer reste une optimisation optionnelle (Sprint 7) si le profilage la justifie.
