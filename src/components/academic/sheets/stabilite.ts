import type { Sheet } from './types';

export const stabiliteSheet: Sheet = {
  id: 'stabilite',
  title: 'Stabilité locale',
  summary: 'Valeurs propres du jacobien et lecture des trajectoires.',
  body: String.raw`
## Linéarisation

Près d’un état stationnaire $x_s$, on écrit $\delta \dot x = J\,\delta x$ avec le **jacobien** $J = \partial f / \partial x$. La stabilité est donnée par les **valeurs propres** $\lambda$ de $J$ :

- toutes de partie réelle négative : **stable** (les perturbations s’éteignent) ;
- au moins une positive : **instable** (elle croît comme $e^{\lambda t}$) ;
- un point **selle** : stable dans une direction, instable dans l’autre.

## Cas du benchmark (niveau 1)

Au point nominal $(C_A, T) = (0{,}5\ \mathrm{mol/L},\ 350\ \mathrm{K})$ :

- $\lambda_1 \approx -1{,}0\ \mathrm{min^{-1}}$ (relaxation de la concentration) ;
- $\lambda_2 \approx +0{,}42\ \mathrm{min^{-1}}$ avec la capacité thermique de paroi ($+2{,}83\ \mathrm{min^{-1}}$ pour le benchmark d’origine, sans paroi).

C’est un **point selle** : une perturbation de ±0,5 K est amplifiée jusqu’à l’un des deux états stables (324,5 K ou 369,7 K).

## Pourquoi la régulation est nécessaire

Maintenir le réacteur à 350 K revient à **stabiliser un point instable** : sans régulateur, la moindre dérive est amplifiée. La constante de temps de la divergence est $1/\lambda_2$ ; le régulateur doit réagir plus vite, avec une vanne dont l’**autorité** est limitée (la chaleur maximale évacuée vaut $U A\,(T - T_{c,in})$).

## Lecture dans l’interface

En mode Manuel, décalez la consigne ou la température d’alimentation de quelques kelvins : la température quitte lentement 350 K puis s’emballe ou s’éteint. En mode Auto, le PID la ramène à la consigne tant que la perturbation reste dans sa capacité d’action (≈ 12 K pour la conception retenue).
`,
};
