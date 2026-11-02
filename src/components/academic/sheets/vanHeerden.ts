import type { Sheet } from './types';

export const vanHeerdenSheet: Sheet = {
  id: 'van-heerden',
  title: 'Van Heerden et multiplicité d’états',
  summary: 'Plusieurs états stationnaires pour un même jeu de paramètres.',
  body: String.raw`
## Le diagramme

À l’état quasi-stationnaire en $C_A$, on trace en fonction de $T$ :

$$Q_{g\acute{e}n}(T) = (-\Delta H_r)\,k(T)\,C_A(T)\,V,\qquad C_A(T) = \frac{(F/V)\,C_{A,in}}{F/V + k(T)}$$

$$Q_{\acute{e}vac}(T) = F\rho C_p\,(T - T_{in}) + U A\,(T - T_c)$$

$Q_{g\acute{e}n}$ a une forme en **S** (la réaction s’emballe puis s’essouffle faute de réactif) ; $Q_{\acute{e}vac}$ est une **droite**.

## États stationnaires

Les **intersections** $Q_{g\acute{e}n} = Q_{\acute{e}vac}$ sont les états stationnaires. Pour le benchmark de Seborg il y en a **trois** :

- ≈ **324,5 K** : faible conversion, stable (réacteur « éteint ») ;
- ≈ **350 K** : conversion moyenne, **instable** (point de fonctionnement de la démonstration) ;
- ≈ **369,7 K** : forte conversion, stable (réacteur « allumé »).

## Critère de stabilité

Un état est stable si, quand $T$ augmente un peu, l’évacuation augmente **plus vite** que la génération :

$$\frac{dQ_{\acute{e}vac}}{dT} > \frac{dQ_{g\acute{e}n}}{dT}$$

Au point central, la pente de la génération dépasse celle de l’évacuation : toute perturbation s’amplifie.

## Hystérésis, allumage et extinction

En balayant $T_c$, le nombre d’états passe de 1 à 3 puis à 1. Pour Seborg :

- $T_c < 298{,}25$ K : seul l’état **bas** subsiste (extinction) ;
- $298{,}25 < T_c < 303{,}00$ K : **bistabilité**, l’état dépend de l’histoire ;
- $T_c > 303{,}00$ K : seul l’état **haut** subsiste (allumage inévitable).

## Dans l’interface

Le graphe de Van Heerden en direct se recalcule quand vous changez $UA$ (agitation, encrassement), $T_c$ ou le débit. Le point de fonctionnement (cercle) se déplace sur la courbe.
`,
};
