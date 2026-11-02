import type { Sheet } from './types';

export const damkohlerSheet: Sheet = {
  id: 'damkohler',
  title: 'Nombres de Damköhler et de Reynolds',
  summary: 'Comparer vitesses de réaction, de renouvellement et d’agitation.',
  body: String.raw`
## Damköhler

$$Da = k(T)\,\tau = \frac{k(T)\,V}{F}$$

C’est le rapport **temps de séjour / temps de réaction** :

- $Da \ll 1$ : le fluide traverse le réacteur avant d’avoir réagi (faible conversion) ;
- $Da \approx 1$ : régime comparable ;
- $Da \gg 1$ : la réaction est quasi complète.

Au point nominal ($T = 350$ K, $\tau = 60$ s), $k = 1/60\ \mathrm{s^{-1}}$ donc $Da \approx 1$. La conversion en CSTR vaut $X = \dfrac{Da}{1 + Da} = 50\,\%$, ce qui correspond à $C_A = 0{,}5$ mol/L.

Comme $k$ dépend exponentiellement de $T$, $Da$ **explose** pendant un emballement : la valeur affichée dans l’interface monte de 1 à plusieurs centaines vers 450 K.

## Reynolds d’agitation

$$Re = \frac{\rho\,N\,D^2}{\mu}$$

avec $N$ la vitesse de rotation [tr/s], $D$ le diamètre de la turbine [m], $\mu$ la viscosité [Pa·s]. Pour une turbine de $D \approx 0{,}17$ m à 120 tr/min dans de l’eau, $Re \approx 5{,}6\cdot 10^4$ : régime **turbulent** ($Re > 10^4$).

## Lien avec le transfert thermique

Le coefficient d’échange suit une corrélation de type Nusselt :

$$Nu \propto Re^{2/3}\,Pr^{1/3} \;\Rightarrow\; U A = \max\!\big(U A_{ref}\,(N/N_{ref})^{2/3},\ U A_{min}\big)\cdot f_{encrassement}$$

Ralentir l’agitation **réduit** $U A$ : le réacteur évacue moins de chaleur et chauffe. Le plancher $U A_{min}$ représente la convection naturelle (le transfert ne tombe jamais à zéro).
`,
};
