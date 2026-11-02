import type { Sheet } from './types';

export const arrheniusSheet: Sheet = {
  id: 'arrhenius',
  title: 'Loi d’Arrhenius et emballement',
  summary: 'Pourquoi une petite hausse de température peut s’emballer.',
  body: String.raw`
## La loi

$$k(T) = k_0\,\exp\!\left(-\frac{E_a}{R\,T}\right)$$

$E_a$ est l’énergie d’activation, $k_0$ le facteur pré-exponentiel, $R$ la constante des gaz parfaits.

## Sensibilité à la température

$$\frac{d\ln k}{dT} = \frac{E_a}{R\,T^2}$$

Avec $E_a/R = 8750$ K et $T = 350$ K : $\dfrac{8750}{350^2} \approx 0{,}071$ K⁻¹, soit **+7 % de vitesse de réaction par kelvin**. La constante de vitesse **double environ tous les 10 K**.

## La boucle d’emballement

$$T \uparrow \;\Rightarrow\; k(T) \uparrow \;\Rightarrow\; \text{chaleur générée} \uparrow \;\Rightarrow\; T \uparrow$$

La chaleur générée croît **exponentiellement** avec $T$, alors que la chaleur évacuée croît seulement **linéairement**. Si l’évacuation ne suit plus, la température diverge.

## Le garde-fou : la consommation du réactif

La réaction consomme $A$ : quand $C_A \to 0$, la chaleur générée s’effondre. L’emballement d’un CSTR est donc un **pic** (de plus en plus raide quand la température monte), pas une divergence infinie. Dans le scénario *Panne de la pompe*, la température de l’état chaud stable atteint ≈ 370 K avec le refroidissement nominal, et bien plus quand le refroidissement est perdu.

## À essayer

Réduisez le débit d’eau froide ou arrêtez la pompe, puis observez dans la colonne de droite : *Q générée* dépasse *Q évacuée*, puis la concentration $C_A$ chute pendant que la température s’envole.
`,
};
