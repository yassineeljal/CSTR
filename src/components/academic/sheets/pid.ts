import type { Sheet } from './types';

export const pidSheet: Sheet = {
  id: 'pid',
  title: 'Régulateur PID et anti-windup',
  summary: 'Action inverse, dérivée sur la mesure, saturation de la vanne.',
  body: String.raw`
## Action inverse

Quand $T$ dépasse la consigne, il faut **ouvrir** la vanne d’eau froide. L’erreur est donc définie par

$$e_k = T_k - T_{sp}$$

ce qui permet de garder $K_p, K_i, K_d > 0$.

## Forme discrète

$$u_k = u_{bias} + K_p\,e_k + K_i\,I_k + K_d\,D_k,\qquad I_k = I_{k-1} + e_k\,\Delta t_c$$

La **dérivée porte sur la mesure** (pas sur l’erreur) et est filtrée : un changement de consigne ne provoque pas de « coup de dérivée ».

$$D_k = \alpha\,D_{k-1} + (1-\alpha)\,\frac{T_k - T_{k-1}}{\Delta t_c},\qquad \alpha = \frac{\tau_f}{\tau_f + \Delta t_c}$$

Le régulateur est **échantillonné** toutes les 0,1 s simulées, indépendamment du pas d’intégration (comme un automate réel).

## Saturation et windup

La vanne ne peut pas dépasser 100 %. Sans précaution, l’intégrale continue de croître pendant la saturation (**windup**) et provoque un fort sous-dépassement au retour à la normale.

**Anti-windup par clamping** : si la sortie est saturée *et* que l’erreur la pousse plus loin dans la saturation, on **n’intègre pas**.

Mesure sur le scénario « charge excessive puis retour à la normale » :

- avec anti-windup : vanne saturée ≈ 3 s, aucun sous-dépassement ;
- sans anti-windup : vanne saturée ≈ 56 s, température ≈ **1,9 K sous la consigne**.

## Transfert sans à-coup

En passant de Manuel à Auto, l’intégrale est initialisée pour que la première sortie égale l’ouverture courante : aucune secousse de la vanne.

## Réglage retenu

$K_p = 0{,}4\ \mathrm{K^{-1}}$, $K_i = 0{,}01\ \mathrm{K^{-1}s^{-1}}$, $K_d = 3\ \mathrm{s/K}$, $\tau_f = 2$ s. Comparé à Ziegler-Nichols et à l’optimum linéaire, il est le plus *doux* (moindre dépassement, vanne la moins sollicitée) pour une intégrale d’erreur un peu plus grande.
`,
};
