# ADR-002 — Communication Worker ↔ UI par postMessage + Float64Array transférable

**Statut :** accepté

**Contexte.** `SharedArrayBuffer` impose COOP/COEP, qui cassent le chargement de ressources tierces (HDRI, polices).

**Décision.** v1 : `postMessage` d'un buffer typé à disposition fixe (`SNAPSHOT_LAYOUT`), ~60 Hz. SharedArrayBuffer reste une optimisation optionnelle (Sprint 7) si le profilage la justifie.

## Suivi (Sprint 7)

`SharedArrayBuffer` n'a **pas** été adopté : le coût mesuré du moteur est de 0,031 ms par tick au pire facteur (×60) pour un budget de 2 ms, et le transfert d'un `Float64Array` de 25 valeurs à 60 Hz est négligeable. Les en-têtes COOP/COEP (qui compliquent le chargement de ressources tierces) ne se justifient pas. À réévaluer si le nombre de canaux ou la fréquence augmentent d'un ordre de grandeur.
