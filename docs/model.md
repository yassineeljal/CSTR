# Modèle du CSTR — référence détaillée

Ce document complète `docs/PLAN.md` §4. Il décrit le modèle **tel qu'implémenté** (`src/simulation/`) et
liste, explicitement, les écarts par rapport au plan avec leur justification mesurée. Les notebooks
`notebooks/01…04` reproduisent chaque chiffre cité ici.

## 1. Équations implémentées

États `x = [C_A, T, T_j, v]`, unités moteur : s, K, mol/L, L, g/L, J, W, Pa.

| Bilan                      | Équation                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| Matière                    | `dC_A/dt = (F_eff/V)(C_A,in − C_A) − k(T)·C_A`                                                     |
| Énergie réacteur           | `dT/dt = [ F_eff·ρ·C_p·(T_in − T) + (−ΔH_r)·k·C_A·V − UA·(T − T_j) − Q̇_relief ] / (V·ρ·C_p + C_w)` |
| Énergie enveloppe (niv. 2) | `dT_j/dt = (F_c/V_j)(T_c,in − T_j) + UA/(V_j·ρ_j·C_p,j)·(T − T_j)`, `F_c = v·F_c,max·η_pompe`      |
| Vanne                      | `dv/dt = clamp((v_cmd − v)/τ_v, ±r_max)`                                                           |
| Arrhenius                  | `k(T) = k₀·f_inhib·exp(−E_a/(R·T))`                                                                |
| Échange                    | `UA = max(UA_ref·(N/N_ref)^(2/3), UA_min) · f_encrassement`                                        |
| Soupape                    | `ṁ_v = C_d·A_s·√(2·ρ_v·(P − P_atm))`, `Q̇ = ṁ_v·L_v`, `ρ_v = P_sat·M/(R·T)`                         |

`F_eff = F · feedFactor` (vanne d'alimentation, 1 en régime normal ; le quench la ferme).
Avec `C_w = 0` et `feedFactor = 1` on retrouve exactement les équations du plan.

Intégration : RK4 à pas fixe de 0,01 s, avec sous-découpage récursif (jusqu'à 64 sous-pas) si
|ΔT| > 5 K sur un pas ; PID échantillonné toutes les 0,1 s simulées ; temps simulé = nombre entier de
pas × dt (indépendant du framerate, testé à 30/60/144 Hz).

## 2. Écarts par rapport au plan, et pourquoi

| #   | Plan                                                          | Implémenté                                                                                       | Justification (mesurée)                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Pas de capacité thermique de paroi                            | `C_w = 5·10⁴ J/K` (≈ 100 kg d'acier inox × 0,5 kJ/kg/K)                                          | Sans elle, 3 s séparent l'alarme HH de la rupture (0,3 s réelles à ×10) : injouable. Avec `C_w`, ≈ 160 s simulées. N'altère pas les états stationnaires.                                                                     |
| 2   | Enveloppe `V_j = 20 L`, `T_c,in = 285 K`, vanne nominale 50 % | `V_j = 5 L`, `T_c,in = 278 K` (5 °C), vanne nominale 30 %, `F_c,max = 1,5103 L/s`                | Notebook 02 : les 4 conceptions sont stabilisables (marge linéaire ≈ −0,033 s⁻¹), mais la retenue offre 44 % de capacité d'évacuation au-delà du nominal (plan : 30 %) et rattrape ≥ 12 K de perturbation (plan : 7,5 K).    |
| 3   | Seuils H = 370 K, HH = 400 K                                  | H = 365 K, HH = 380 K                                                                            | H/HH du plan arrivent trop tard pour une intervention. L'état haut stable est à 369,7 K : H s'y déclenche, HH non.                                                                                                           |
| 4   | Quench = diluant seul (+ inhibiteur optionnel)                | Diluant 60 L à 280 K, inhibiteur ×0,05 pendant 180 s **et fermeture de la vanne d'alimentation** | Notebook 04 (« 4 bis ») : sans arrêt de l'alimentation, le réacteur repart et se rompt.                                                                                                                                      |
| 5   | Soupape `A_s` non précisée                                    | `A_s = 6·10⁻⁶ m²` (Ø ≈ 2,8 mm), volontairement sous-dimensionnée                                 | Mesuré en simulation : à partir de ≈ 1·10⁻⁵ m² la température plafonne sous 450 K (plateau vers 420–449 K) et il n'y a plus de rupture, ce qui supprime l'enjeu pédagogique ; à 8·10⁻⁶ m² la rupture survient après ≈ 270 s. |
| 6   | Quench « instantané sur ~2 s »                                | 200 injections élémentaires sur 2 s, avec accumulation du diluant puis surverse                  | Le cumul redonne exactement la formule du plan `C_A·V/(V+V_q)`, `(V·T + V_q·T_q)/(V+V_q)` (test `scenarios.test.ts`).                                                                                                        |
| 7   | `SNAPSHOT_SIZE = 16`                                          | 25 champs (Fc, η, f, mode, statut, timeScale, inhibiteur, quench, alimentation)                  | Les shaders et le HUD en ont besoin sans canal supplémentaire.                                                                                                                                                               |
| 8   | PID `K_p, K_i, K_d` à déterminer                              | `K_p = 0,4`, `K_i = 0,01`, `K_d = 3`, `τ_f = 2 s`, `u_bias = 0,3`                                | Notebook 03 (comparaison ZN / optimum linéaire / retenu).                                                                                                                                                                    |

## 3. Jeux de paramètres

### 3.1 Benchmark de Seborg (`presets/seborgBenchmark.ts`)

Valeurs du plan §4.6, converties en secondes. États stationnaires du niveau 1 :

| C_A [mol/L] | T [K]   | Stabilité                                                    |
| ----------- | ------- | ------------------------------------------------------------ |
| 0,8773      | 324,475 | stable                                                       |
| 0,4999      | 350,006 | **instable** (λ = +0,42 min⁻¹ avec `C_w` ; +2,83 min⁻¹ sans) |
| 0,2088      | 369,705 | stable avec `C_w` (foyer instable sans)                      |

Le résidu des dérivées au point nominal (≈ 1,2·10⁻⁴ K/s) vient de l'arrondi du plan `k₀ = 1,2·10⁹`
(`k(350) = 0,016666 s⁻¹` à 7·10⁻⁵ près).

### 3.2 Hydrolyse de l'oxyde de propylène (`presets/propyleneOxide.ts`) — S1-C01

Source : H. S. Fogler, _Elements of Chemical Reaction Engineering_, 5e éd., chap. 12 :
`k = 16,96·10¹² exp(−32 400/(R·T)) h⁻¹` (R en Btu/lbmol/°R), `ΔH_rx = −36 000 Btu/lbmol`.
Conversion (1 Btu/lbmol = 2,326 J/mol) : `E_a = 75,36 kJ/mol`, `ΔH = −83,74 kJ/mol`, `k₀ = 4,711·10⁹ s⁻¹`.

Les conditions opératoires (`C_A,in = 4 mol/L`, `F = 0,5 L/s`, `T_in = 300 K`, `UA = 500 W/K`,
`T_c = 285 K`) sont des **hypothèses pédagogiques** choisies par recherche en grille pour obtenir trois
états stationnaires : 302,5 K (stable), 326,8 K (**instable**, λ = +0,25 min⁻¹), 353,7 K (stable).
`TODO(chem)` : valider avec un cas industriel (concentration réaliste ≈ 1–2 mol/L donne un seul état).
La température de rupture n'y est pas atteignable (`T_ad,max ≈ 380 K`).

## 4. Seuils d'alarme et rupture (S2-C03)

| Jeu                | LL    | H     | HH    | Rupture | Bande morte |
| ------------------ | ----- | ----- | ----- | ------- | ----------- |
| Seborg             | 330 K | 365 K | 380 K | 450 K   | 2 K         |
| Oxyde de propylène | 295 K | 340 K | 350 K | 400 K   | 2 K         |

L'alarme LL n'est armée qu'après un premier dépassement de `LL + bande morte` (pas d'alarme à froid).
`450 K` correspond à ≈ 9,3 bar de vapeur saturante + 1 bar d'inerte : au-delà de la pression de calcul
usuelle d'une cuve de process.

## 5. Corrélation `U(N)` (S4-C01) et soupape (S4-C02)

- `UA ∝ N^(2/3)` (Nu ∝ Re^(2/3) Pr^(1/3)), plancher `UA_min = 10 % de UA_ref` (convection naturelle).
  `TODO(chem)` : l'exposant et le plancher dépendent de la géométrie ; à valider sur une corrélation
  de type Chilton-Drew-Jebens pour la double enveloppe.
- Soupape : tarage 3,0 bar abs., fermeture à 90 % du tarage, `C_d = 0,65`, `L_v = 2,257 MJ/kg`
  (constante : elle diminue vers 1,95 MJ/kg à 200 °C). Le liquide évacué n'est pas retiré du bilan de
  masse (hypothèse de volume constant).

## 6. Quench (S5-C02)

Diluant : 60 L à 280 K ; mélange final `C_A → 0,625·C_A`, `T → (100·T + 60·280)/160`. Inhibiteur :
`k₀ × 0,05` pendant 180 s simulées. Alimentation coupée. À 390 K (scénario 4) : T tombe à ≈ 345–349 K
(moteur TS / modèle Python), le réactif résiduel est consommé, pas de rupture. L'alimentation se rouvre par la commande
`setFeedFactor`.

## 7. Limites connues

- Pression = inerte + vapeur saturante de l'eau pure (le milieu réel contient réactif et produits).
- Réaction d'ordre 1 irréversible, volume constant, mélange parfait, paroi en équilibre thermique
  instantané avec le milieu, pas de perte de charge ni de dynamique de pompe.
- Les valeurs marquées `TODO(chem)` dans les presets n'ont pas été validées par l'équipe Génie Chimique.
