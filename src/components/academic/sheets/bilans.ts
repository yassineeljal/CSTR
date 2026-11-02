import type { Sheet } from './types';

export const bilansSheet: Sheet = {
  id: 'bilans',
  title: 'Bilans de matière et d’énergie',
  summary: 'Les équations qui gouvernent le réacteur, terme par terme.',
  body: String.raw`
## Hypothèses

- Réacteur **parfaitement agité** : concentration et température uniformes.
- Réaction irréversible d’ordre 1, $A \to B$, **exothermique** ($\Delta H_r < 0$).
- Volume constant (le débit sortant égale le débit entrant), $\rho$ et $C_p$ constants.

## Bilan de matière

$$\frac{dC_A}{dt} = \underbrace{\frac{F}{V}\,(C_{A,in} - C_A)}_{\text{convection}} - \underbrace{k(T)\,C_A}_{\text{réaction}}$$

Le rapport $\tau = V/F$ est le **temps de séjour** (60 s au point nominal).

## Bilan d’énergie du réacteur

$$\left(V\rho C_p + C_w\right)\frac{dT}{dt} = F\rho C_p\,(T_{in} - T) + (-\Delta H_r)\,k(T)\,C_A\,V - U A\,(T - T_j) - \dot Q_{relief}$$

Chaque terme est une puissance [W] :

- **alimentation** : l’entrée chaude ou froide réchauffe ou refroidit le milieu ;
- **réaction** : la chaleur dégagée, proportionnelle à $k(T)\,C_A$ ;
- **échange** avec l’enveloppe : $U A\,(T - T_j)$ ;
- **soupape** : chaleur latente emportée par la vapeur évacuée (voir la fiche *Sécurité*).

$C_w$ est la capacité thermique de la paroi de cuve (≈ 100 kg d’acier, 50 kJ/K). Elle **ralentit** la dynamique mais ne modifie pas les états stationnaires.

## Bilan d’énergie de l’enveloppe

$$\frac{dT_j}{dt} = \frac{F_c}{V_j}\,(T_{c,in} - T_j) + \frac{U A}{V_j\,\rho_j C_{p,j}}\,(T - T_j),\qquad F_c = v\,F_{c,max}\,\eta_{pompe}$$

La vanne est un système du premier ordre à vitesse limitée : $\dot v = \mathrm{clamp}\big((v_{cmd}-v)/\tau_v,\ \pm r_{max}\big)$.

## Ce que montre l’interface

Les valeurs vivantes de la colonne de droite sont les termes de ces équations : *Q générée* (réaction) et *Q évacuée* (alimentation + enveloppe + soupape). Quand elles sont égales, $dT/dt = 0$.
`,
};
