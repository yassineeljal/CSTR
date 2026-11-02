import type { Sheet } from './types';

export const securiteSheet: Sheet = {
  id: 'securite',
  title: 'Sécurité des procédés : soupape et quench',
  summary: 'Pression de vapeur, décharge par la soupape, arrêt d’urgence.',
  body: String.raw`
## Pression

$$P(T) = P_{inerte} + P_{sat}(T)$$

$P_{sat}$ suit l’équation d’Antoine de l’eau : $\log_{10} P\,[\mathrm{mmHg}] = A - \dfrac{B}{C + T\,[^\circ\mathrm{C}]}$ (deux plages, 1–100 °C et 100–374 °C).

> **Simplification assumée** : le milieu réel contient du réactif et des produits ; ici la pression est celle de l’eau pure plus un inerte. C’est un modèle pédagogique, pas un calcul de dimensionnement.

## Soupape de sécurité

Elle s’ouvre quand $P > P_{tarage}$ (3 bar) et se referme sous $0{,}9\,P_{tarage}$ (hystérésis). Le débit de vapeur évacué est

$$\dot m_v = C_d\,A_s\,\sqrt{2\,\rho_v\,(P - P_{atm})},\qquad \dot Q_{relief} = \dot m_v\,L_v$$

et la chaleur latente emportée **refroidit** le milieu.

Dans la simulation la soupape est **volontairement sous-dimensionnée** ($A_s = 6\ \mathrm{mm^2}$) : elle ralentit l’emballement mais ne l’arrête pas, sans quoi le scénario n’aurait pas d’enjeu. Dimensionner une vraie soupape (DIERS, API 520) est un autre métier.

## Quench

Injection de $V_q$ de diluant froid à $T_q$, sans réactif :

$$C_A \leftarrow C_A\,\frac{V}{V+V_q},\qquad T \leftarrow \frac{V\,T + V_q\,T_q}{V + V_q}$$

Avec $V_q = 60$ L à 280 K et $V = 100$ L : la concentration est multipliée par 0,625 et un réacteur à 390 K redescend vers ≈ 350 K.

Le quench de l’application ajoute :

- un **inhibiteur** ($k_0 \times 0{,}05$ pendant 180 s simulées) ;
- la **fermeture de la vanne d’alimentation**.

Sans coupure de l’alimentation, le réacteur continue de recevoir du réactif chaud alors que l’enveloppe est hors service : il repart et se rompt (mesuré en simulation). Après un quench, il faut **rétablir le refroidissement** avant de rouvrir l’alimentation.

## Critère de rupture

À 450 K, la pression de vapeur saturante atteint ≈ 9,3 bar, au-delà de la pression de calcul usuelle d’une cuve de procédé : c’est le seuil de **perte de confinement** de la simulation.
`,
};
