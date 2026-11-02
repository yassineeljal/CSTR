# 🧪 CSTR Digital Twin — Simulateur 3D temps réel d'emballement thermique

> Jumeau numérique d'un réacteur chimique agité continu (CSTR) exothermique, simulé à 60 Hz dans le navigateur, rendu en 3D (React Three Fiber + shaders GLSL), piloté depuis un poste de contrôle de style SCADA, et déployé sur Vercel.
>
> Projet conjoint **Génie Chimique (Polytechnique Montréal)** × **Génie Logiciel / 3D (ÉTS)**.

---

## 📑 Table des matières

0. [Instructions pour l'agent IA (À LIRE EN PREMIER)](#0-instructions-pour-lagent-ia-à-lire-en-premier)
1. [Vision & périmètre](#1-vision--périmètre)
2. [Décisions d'architecture (ADR)](#2-décisions-darchitecture-adr)
3. [Stack technologique](#3-stack-technologique)
4. [Modèle mathématique complet](#4-modèle-mathématique-complet)
5. [Architecture logicielle](#5-architecture-logicielle)
6. [Structure des dossiers](#6-structure-des-dossiers)
7. [Plan de réalisation — Sprints 0 à 7](#7-plan-de-réalisation--sprints-0-à-7)
8. [Stratégie de tests](#8-stratégie-de-tests)
9. [Budget de performance](#9-budget-de-performance)
10. [CI/CD & déploiement Vercel](#10-cicd--déploiement-vercel)
11. [Conventions de code](#11-conventions-de-code)
12. [Risques & parades](#12-risques--parades)
13. [Backlog d'extensions (post-v1)](#13-backlog-dextensions-post-v1)
14. [Glossaire](#14-glossaire)

---

## 📊 Statut d'avancement

| Sprint | Statut | Notes |
| --- | --- | --- |
| 0 — Fondations | ✅ terminé | CI, ADR, Vitest, Playwright |
| 1 — Modèle validé | ✅ terminé | Notebooks 01–02, deux presets, `docs/model.md` |
| 2 — Moteur RK4 + PID | ✅ terminé | 150+ tests, golden < 3·10⁻⁸, `/debug`, worker ≈ 60 Hz |
| 3 — Scène 3D | ✅ terminé | Hybride procédural + Blender (ADR-003), coupe animée, < 100 draw calls |
| 4 — Shaders & effets | ✅ terminé | Fluide/enveloppe/bulles/vapeur sur GPU, Bloom, rupture |
| 5 — SCADA & scénarios | ✅ terminé | HUD complet, 16 tests e2e, presets, raccourcis |
| 6 — Inspection académique | ✅ terminé | i18n FR/EN (optionnel) non fait |
| 7 — Production | ✅ terminé (hors liaison Vercel / domaine / Supabase) | voir `docs/perf.md` |

> Les écarts de modèle décidés en cours de route (capacité de paroi, enveloppe, seuils d'alarme, quench) sont listés avec leur justification dans [`docs/model.md`](model.md) §2. Le §4.6 ci-dessous reste le jeu *de départ* du plan.

---

## 0. Instructions pour l'agent IA (À LIRE EN PREMIER)

Ce README est la **source de vérité** du projet. Tu (l'agent IA) dois le suivre dans l'ordre.

### 0.1 Règles de travail

1. **Un sprint à la fois, une tâche à la fois.** Les tâches ont un identifiant (`S2-T04`). Traite-les dans l'ordre sauf si une tâche indique explicitement qu'elle est parallélisable.
2. **Ne passe jamais au sprint suivant** tant que tous les critères de la *Definition of Done* (DoD) du sprint courant ne sont pas remplis (tests verts, build OK, critères d'acceptation vérifiés).
3. **Tests d'abord pour le cœur physique.** Tout fichier dans `src/simulation/` doit avoir ses tests Vitest *avant* d'être branché à l'interface.
4. **Aucune constante physique codée en dur hors de `src/simulation/constants.ts`** (ou des presets de scénarios). Chaque constante porte son unité en commentaire et, si possible, une source.
5. **Unités SI partout dans le moteur** (s, K, mol/m³ ou mol/L — voir §4.6, J, W, Pa). Les conversions d'affichage (°C, bar, min) se font **uniquement** dans la couche UI (`src/lib/units.ts`).
6. **Ne jamais utiliser `useState` / re-rendu React pour des données à 60 Hz** (voir §5.4). Toute violation est un bug bloquant.
7. **TypeScript strict** (`"strict": true`, `noUncheckedIndexedAccess: true`). Pas de `any` sauf justification en commentaire.
8. **Petits commits atomiques** au format Conventional Commits (`feat(sim): add RK4 integrator`). Un commit = une tâche ou une sous-tâche.
9. Quand une information manque (ex. constante pas encore fournie par l'équipe Génie Chimique), **utilise les valeurs par défaut du §4.6**, marque-les `// TODO(chem): valider` et continue. Ne bloque pas.
10. Quand une décision n'est pas couverte par ce document, choisis l'option la plus simple, documente-la dans `docs/decisions/` (format ADR court) et continue.
11. À la fin de chaque sprint, mets à jour `CHANGELOG.md` et coche les tâches dans ce README (section 7).

### 0.2 Definition of Done globale (s'applique à chaque tâche)

- [ ] `pnpm lint` sans erreur
- [ ] `pnpm typecheck` sans erreur
- [ ] `pnpm test` vert
- [ ] `pnpm build` réussit
- [ ] Pas de `console.log` oublié (sauf logger dédié en mode debug)
- [ ] Le déploiement de prévisualisation Vercel fonctionne

### 0.3 Version des dépendances

Utilise la **dernière version stable** de chaque dépendance au moment de l'initialisation (Next.js ≥ 15 avec App Router, React ≥ 19, Three.js récent, etc.). Vérifie la compatibilité entre `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` et la version de React installée **avant** d'écrire du code. Fige les versions dans `package.json` (pas de `^` sur les paquets 3D).

---

## 1. Vision & périmètre

### 1.1 Pitch

Un utilisateur ouvre une URL, voit un réacteur industriel en coupe 3D, avec son agitateur qui tourne et son liquide dont la couleur reflète la température. Il pilote les débits, la consigne et les gains du PID. Il déclenche une panne de refroidissement : la température grimpe exponentiellement (loi d'Arrhenius), le liquide passe du bleu à l'orange puis au rouge incandescent, la soupape crache de la vapeur… et il a quelques secondes pour faire un **quench d'urgence**.

### 1.2 Public cible

- Professeurs et étudiants en génie chimique (outil pédagogique : stabilité, multiplicité des états stationnaires, régulation).
- Recruteurs (portfolio : 3D temps réel, shaders, architecture multi-thread, rigueur scientifique).

### 1.3 Dans le périmètre (v1)

- Moteur physique CSTR exothermique non isotherme (bilans matière + énergie + double enveloppe + vanne).
- Intégrateur RK4 à pas fixe, découplé du framerate, avec accélération temporelle.
- Régulateur PID discret avec anti-windup, modes Manuel / Auto.
- Modèle simplifié de pression + soupape de sécurité.
- Scène 3D procédurale (sans dépendance obligatoire à Blender) avec vue en coupe.
- Shaders thermiques (liquide + enveloppe), Bloom, particules (bulles + vapeur).
- HUD SCADA : contrôles, graphes temps réel, alarmes, 4 scénarios.
- Mode « Inspection académique » : étiquettes 3D avec formules KaTeX et valeurs vivantes.
- Presets sauvegardables (localStorage en v1, Supabase en option).
- Déploiement Vercel avec domaine personnalisé.

### 1.4 Hors périmètre (v1)

- Comptes utilisateurs, multijoueur.
- Mécanique des fluides numérique (CFD) réelle — le fluide est **représenté visuellement**, pas résolu.
- Architecture B (microservice temps réel) — voir §13.

---

## 2. Décisions d'architecture (ADR)

### ADR-001 — Simulation 100 % côté client dans un Web Worker (Architecture A)

**Contexte.** Vercel est une plateforme serverless : les fonctions s'arrêtent après l'exécution et ne peuvent ni maintenir une boucle physique continue ni garder une connexion WebSocket persistante.

**Décision.** Le moteur (RK4 + PID) tourne dans un **Web Worker dédié** en TypeScript. L'application Next.js est servie statiquement par Vercel.

**Conséquences.**
- ✅ Latence réseau nulle, coût d'hébergement nul, fonctionne hors ligne.
- ✅ Le thread principal reste libre pour React et WebGL.
- ⚠️ La performance dépend de la machine du client (négligeable ici : 2 à 4 EDO, RK4 très bon marché).
- 🔁 L'architecture B (FastAPI/Go + WebSockets sur VPS) reste possible plus tard grâce à une **interface d'abstraction `SimulationTransport`** (§5.3).

### ADR-002 — Communication Worker ↔ UI via `postMessage` + `Float64Array` transférable

`SharedArrayBuffer` exige les en-têtes COOP/COEP (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`), qui cassent souvent le chargement de ressources tierces (HDRI, polices). **v1 : `postMessage`** avec un buffer typé à disposition fixe (§5.2), envoyé à ~60 Hz. `SharedArrayBuffer` = optimisation optionnelle au Sprint 7 si le profilage le justifie.

### ADR-003 — Géométrie 3D procédurale d'abord, `.glb` en option

Un agent IA ne peut pas utiliser Blender. La cuve, l'enveloppe, les chicanes, l'arbre et la turbine Rushton sont générés **en code** (`LatheGeometry`, `CylinderGeometry`, `BoxGeometry`) à partir des proportions de `src/simulation/geometry.ts`. La coupe à 90° est obtenue par **plans de découpe** (`clippingPlanes`) ou par géométrie à angle partiel (`thetaLength = 1.5π`). Un modèle `.glb` Draco fait sous Blender par un humain peut remplacer la version procédurale plus tard sans changer l'API du composant.

### ADR-004 — TypeScript pour le moteur, Python pour la validation

Le moteur de production est en TypeScript (un seul langage à déployer). Python (NumPy/SciPy) sert de **référence de vérité** : les notebooks génèrent des fichiers `golden` (CSV/JSON) que les tests Vitest comparent au moteur TS (§8.2). Une version Rust → WASM est une extension (§13).

### ADR-005 — Zustand en « transient updates » + buffers mutables

L'état physique 60 Hz vit dans un objet mutable hors React (`simRef`). Zustand ne stocke que l'état « lent » (paramètres, mode, scénario, alarmes). Les composants 3D lisent l'état rapide dans `useFrame` ; les graphes lisent dans leur propre boucle `requestAnimationFrame`.

---

## 3. Stack technologique

| Couche | Technologie | Rôle |
| --- | --- | --- |
| Framework web | **Next.js (App Router) + TypeScript strict** | App, routing, déploiement Vercel natif |
| Gestionnaire de paquets | **pnpm** | Installations rapides, lockfile fiable |
| Styles | **Tailwind CSS** | HUD SCADA |
| 3D | **three**, **@react-three/fiber**, **@react-three/drei** | Scène, caméra, `OrbitControls`, `Environment`, `<Html>` |
| Post-processing | **@react-three/postprocessing** | Bloom, vignette |
| Shaders | **GLSL** (via `shaderMaterial` de drei ou `ShaderMaterial`) | Liquide thermique, vortex, enveloppe |
| État | **Zustand** | État lent + accès transient |
| Graphes | **uPlot** | Courbes glissantes 60 Hz |
| Formules | **KaTeX** | Étiquettes LaTeX en mode Inspection |
| Worker | **Web Worker natif** (`new Worker(new URL(..., import.meta.url))`) | Boucle physique |
| Tests unitaires | **Vitest** | Moteur, PID, utilitaires |
| Tests E2E | **Playwright** | Parcours utilisateur, FPS smoke test |
| Lint/format | **ESLint + Prettier** | Qualité |
| Debug 3D | **leva** (dev uniquement), **r3f-perf** | Réglages live, mesure GPU |
| Prototypage chimique | **Python 3.11+, NumPy, SciPy, Matplotlib, Jupyter** | Validation du modèle |
| Persistance (option) | **Supabase (PostgreSQL)** | Presets partagés, télémétrie |
| CI | **GitHub Actions** | Lint, tests, build |
| Hébergement | **Vercel** | Prod + previews par PR |

---

## 4. Modèle mathématique complet

> Section de référence pour l'équipe Génie Chimique **et** pour l'implémentation. Toute modification du modèle doit être répercutée ici.

### 4.1 Hypothèses

1. Réacteur parfaitement agité (concentration et température uniformes).
2. Réaction irréversible d'ordre 1 : A → B, exothermique (ΔH_r < 0).
3. Volume V constant (débit d'entrée = débit de sortie), masse volumique ρ et capacité thermique C_p constantes.
4. Double enveloppe parfaitement agitée (température uniforme T_j).
5. Pression modélisée de façon simplifiée (§4.4) — ne rétroagit pas sur la cinétique.

### 4.2 Variables d'état

| Symbole | Description | Unité moteur |
| --- | --- | --- |
| C_A | Concentration du réactif A | mol/L |
| T | Température du réacteur | K |
| T_j | Température de l'eau dans la double enveloppe | K |
| v | Ouverture réelle de la vanne d'eau froide (0 → 1) | — |
| I | Intégrale de l'erreur du PID | K·s (état du contrôleur, pas de l'EDO) |

Vecteur d'état de l'EDO : **x = [C_A, T, T_j, v]**.

### 4.3 Équations

**Loi d'Arrhenius**

$$k(T) = k_0 \exp\left(-\frac{E_a}{R\,T}\right)$$

**Bilan de matière**

$$\frac{dC_A}{dt} = \frac{F}{V}\left(C_{A,\text{in}} - C_A\right) - k(T)\,C_A$$

**Bilan d'énergie du réacteur**

$$\frac{dT}{dt} = \frac{F}{V}\left(T_{\text{in}} - T\right) + \frac{(-\Delta H_r)}{\rho\,C_p}\,k(T)\,C_A - \frac{U A}{V\,\rho\,C_p}\left(T - T_j\right)$$

**Bilan d'énergie de la double enveloppe** (niveau 2 du modèle)

$$\frac{dT_j}{dt} = \frac{F_c}{V_j}\left(T_{c,\text{in}} - T_j\right) + \frac{U A}{V_j\,\rho_j\,C_{p,j}}\left(T - T_j\right), \qquad F_c = v \cdot F_{c,\max} \cdot \eta_{\text{pompe}}$$

où η_pompe ∈ [0, 1] vaut 1 en fonctionnement normal et 0 lors d'une panne de pompe.

**Dynamique de la vanne** (1er ordre + limitation de vitesse)

$$\frac{dv}{dt} = \text{clamp}\left(\frac{v_{\text{cmd}} - v}{\tau_v},\ -r_{\max},\ +r_{\max}\right)$$

**Effet de l'agitation sur U** (corrélation de type Nusselt, Nu ∝ Re^{2/3} Pr^{1/3}) :

$$U(N) = U_{\text{ref}} \left(\frac{N}{N_{\text{ref}}}\right)^{2/3} \cdot f_{\text{encrassement}}, \qquad Re = \frac{\rho N D_{\text{turbine}}^2}{\mu}$$

f_encrassement ∈ ]0, 1] (1 = paroi propre). Si N → 0, borner U à une valeur de convection naturelle `U_min` (ne jamais tomber à 0).

**Niveaux de modèle** (sélectionnables, utiles pour le débogage et la pédagogie) :
- **Niveau 1** — 2 états [C_A, T], T_j = T_c imposée directement (modèle benchmark de Seborg, §4.6). Sert aux tests de référence.
- **Niveau 2** — 4 états [C_A, T, T_j, v] (modèle complet, par défaut dans l'app).

### 4.4 Pression et soupape (modèle simplifié)

$$P(T) = P_{\text{inerte}} + P_{\text{sat}}(T)$$

P_sat par l'équation d'Antoine de l'eau (log₁₀ P[mmHg] = A − B / (C + T[°C])) :
- 1–100 °C : A = 8.07131, B = 1730.63, C = 233.426
- 100–374 °C : A = 8.14019, B = 1810.94, C = 244.485

Convertir en Pa (1 mmHg = 133.322 Pa).

**Soupape** : si P > P_tarage, elle s'ouvre (hystérésis : se referme sous 0.9·P_tarage). Effet thermique : évacuation de vapeur avec refroidissement par chaleur latente :

$$\dot Q_{\text{relief}} = \dot m_v \cdot L_v, \qquad \dot m_v = C_d \, A_s \sqrt{2\,\rho_v\,(P - P_{\text{atm}})}$$

Terme ajouté au bilan d'énergie : −Q̇_relief / (V ρ C_p). Le débit `ṁ_v` pilote aussi l'intensité du panache de particules.

> `TODO(chem)` : l'équipe Génie Chimique valide ou simplifie ce modèle au Sprint 4 (S4-C02).

### 4.5 Régulateur PID discret

- **Variable mesurée** : T. **Variable manipulée** : v_cmd (ouverture de vanne commandée).
- **Action inverse** : quand T dépasse la consigne, il faut **ouvrir** la vanne. On définit donc l'erreur ainsi :

$$e_k = T_k - T_{\text{sp}}$$

(convention qui permet de garder K_p, K_i, K_d positifs).

- **Forme positionnelle, dérivée sur la mesure** (évite le « derivative kick » au changement de consigne), filtrée :

$$u_k = u_{\text{bias}} + K_p\, e_k + K_i\, I_k + K_d\, D_k$$
$$D_k = \alpha\, D_{k-1} + (1-\alpha)\,\frac{T_k - T_{k-1}}{\Delta t_c}, \qquad \alpha = \frac{\tau_f}{\tau_f + \Delta t_c}$$

- **Anti-windup par clamping (intégration conditionnelle)** :
  1. Calculer u_k non saturé avec I_k candidat = I_{k-1} + e_k Δt_c.
  2. v_cmd = clamp(u_k, 0, 1).
  3. Si u_k est saturé **et** que e_k pousse dans le sens de la saturation → **ne pas** mettre à jour I (garder I_{k-1}).
- **Transfert sans à-coup (bumpless)** Manuel → Auto : à l'activation, initialiser I pour que u = v actuelle.
- **Période du contrôleur** Δt_c = 0.1 s (temps simulé), indépendante du pas RK4 (le PID est échantillonné, comme un vrai automate).

### 4.6 Jeu de paramètres par défaut

> **Point de départ = benchmark CSTR classique de Seborg** (exprimé ici en secondes). Avec T_j = 300 K imposée (niveau 1), le point **C_A = 0.5 mol/L, T = 350 K est un état stationnaire exact** — vérifié numériquement — et il est **instable en boucle ouverte** (valeurs propres du jacobien ≈ −0.454 et **+2.83 min⁻¹**). C'est idéal pour la démo : sans PID, le réacteur dérive soit vers l'extinction, soit vers l'emballement.
>
> L'équipe Génie Chimique remplacera ces valeurs par celles d'une réaction réelle (ex. hydrolyse de l'oxyde de propylène ou de l'anhydride acétique) au Sprint 1. **Le code doit fonctionner avec les deux jeux** (fichiers de presets distincts).

| Paramètre | Symbole | Valeur (benchmark) | Unité moteur |
| --- | --- | --- | --- |
| Volume réacteur | V | 100 | L |
| Débit d'alimentation | F | 100/60 ≈ 1.6667 | L/s |
| Concentration d'entrée | C_A,in | 1.0 | mol/L |
| Température d'entrée | T_in | 350 | K |
| Facteur pré-exponentiel | k₀ | 7.2·10¹⁰ / 60 = 1.2·10⁹ | s⁻¹ |
| Énergie d'activation / R | E_a/R | 8750 | K |
| Enthalpie de réaction | ΔH_r | −5.0·10⁴ | J/mol |
| Masse volumique | ρ | 1000 | g/L |
| Capacité thermique | C_p | 0.239 | J/(g·K) |
| Coefficient global × surface | UA | 5·10⁴ / 60 ≈ 833.33 | J/(s·K) |
| Température eau froide (niveau 1) | T_c | 300 | K |
| Volume enveloppe *(niv. 2, à valider)* | V_j | 20 | L |
| Température entrée eau froide *(niv. 2)* | T_c,in | 285 | K |
| Débit max eau froide *(niv. 2, à dimensionner)* | F_c,max | à calculer en S1-C04 | L/s |
| Constante de temps vanne | τ_v | 2 | s |
| Vitesse max vanne | r_max | 0.25 | s⁻¹ |
| Agitation nominale | N_ref | 120 | tr/min |
| Pression inerte | P_inerte | 1.013·10⁵ | Pa |
| Tarage soupape | P_tarage | 3.0·10⁵ | Pa |
| Seuil d'alarme haute | T_HH | 400 | K |
| Seuil de rupture (game over) | T_rupture | 450 | K |
| Pas RK4 | Δt | 0.01 | s (simulé) |
| Période PID | Δt_c | 0.1 | s (simulé) |

> ⚠️ **Unités** : avec ρ en g/L et C_p en J/(g·K), le produit ρ·C_p est en J/(L·K), cohérent avec V en L, C_A en mol/L, ΔH_r en J/mol. Garder **exactement** ce système dans le moteur ; l'affichage convertit.

### 4.7 Temps simulé vs temps réel

La dynamique d'un CSTR est de l'ordre de la **minute**. Une démo en temps réel strict serait lente. Le moteur expose un **facteur d'accélération** `timeScale ∈ {1, 5, 10, 30, 60}` (défaut 10). À chaque tick du worker :

```
simTimeToAdvance = realElapsed * timeScale
nombre de pas RK4 = floor((accumulator + simTimeToAdvance) / dt)
```

Plafonner le nombre de pas par tick (ex. 2000) pour éviter la « spirale de la mort » si l'onglet était en arrière-plan.

### 4.8 Scénarios préprogrammés

| # | Nom | Conditions initiales | Événement scripté | Attendu pédagogique |
| --- | --- | --- | --- | --- |
| 1 | **Démarrage à froid** | C_A = 0, T = 300 K, PID Auto, T_sp = 350 K | Aucun | Montée en température, dépassement, stabilisation |
| 2 | **Panne pompe de refroidissement** | État stationnaire à 350 K | t = 20 s : η_pompe → 0 | Emballement, soupape, nécessité du quench |
| 3 | **Encrassement** | État stationnaire | f_encrassement : 1 → 0.4 linéairement sur 120 s | Vanne qui sature, windup évité, perte de contrôle progressive |
| 4 | **Quench d'urgence** | Scénario 2 avancé jusqu'à T = 390 K | Bouton utilisateur | Injection d'un diluant froid ; le réacteur est sauvé ou non |

**Modèle du quench** : injection instantanée (sur ~2 s) d'un volume V_q de diluant froid à T_q, sans réactif. Mise à jour par mélange :

$$C_A \leftarrow C_A \frac{V}{V+V_q}, \qquad T \leftarrow \frac{V\,T + V_q\,T_q}{V + V_q}$$

(avec option d'ajout d'un inhibiteur qui multiplie k₀ par un facteur ≪ 1 pendant une durée donnée).

### 4.9 Nombres adimensionnels affichés (mode Inspection)

- **Damköhler** : Da = k(T)·τ avec τ = V/F (temps de séjour).
- **Reynolds d'agitation** : Re = ρ N D² / μ.
- **Critère de stabilité (pente de Van Heerden)** : stable localement si dQ_évac/dT > dQ_gén/dT au point de fonctionnement.

---

## 5. Architecture logicielle

### 5.1 Flux de données

```text
┌──────────────────────────── Thread principal (UI) ────────────────────────────┐
│                                                                                │
│  HUD SCADA (React)  ──commandes──►  SimulationClient  ──postMessage(cmd)──┐    │
│        ▲                                   │                              │    │
│        │ (état lent : Zustand)             │ onmessage(snapshot)          │    │
│        │                                   ▼                              │    │
│   useReactorStore ◄──── alarmes/mode ── simRef (Float64Array mutable)     │    │
│                                          │          │                     │    │
│                          useFrame (R3F) ◄┘          └► TelemetryCharts    │    │
│                          uniforms shaders               (rAF + ring buf)  │    │
└───────────────────────────────────────────────────────────────────────────┼────┘
                                                                            │
┌──────────────────────────── Web Worker ───────────────────────────────────▼────┐
│  simulation.worker.ts                                                          │
│   boucle setInterval(16 ms) / accumulateur ─► RK4 (dt=0.01 s) × n              │
│                                            ─► PID (toutes les 0.1 s simulées)  │
│                                            ─► scénario (événements temporels)  │
│                                            ─► alarmes / soupape / rupture      │
│   ──► postMessage(snapshot: Float64Array, [buffer])  ~60 Hz                    │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Protocole de messages (contrat strict)

Fichier : `src/simulation/protocol.ts`

```ts
// UI → Worker
export type WorkerCommand =
  | { type: 'init'; params: ReactorParams; initialState: ReactorState }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'reset'; initialState?: ReactorState }
  | { type: 'setParams'; patch: Partial<ReactorParams> }
  | { type: 'setPid'; patch: Partial<PidGains> & { setpoint?: number } }
  | { type: 'setMode'; mode: 'manual' | 'auto' }
  | { type: 'setManualValve'; value: number }        // 0..1
  | { type: 'setTimeScale'; value: number }
  | { type: 'loadScenario'; id: ScenarioId }
  | { type: 'quench' };

// Worker → UI
export type WorkerEvent =
  | { type: 'snapshot'; buffer: Float64Array }      // disposition SNAPSHOT_LAYOUT
  | { type: 'alarm'; alarm: AlarmEvent }
  | { type: 'scenarioEvent'; label: string; simTime: number }
  | { type: 'rupture'; simTime: number }
  | { type: 'error'; message: string };

// Disposition fixe du snapshot (indices)
export const SNAPSHOT_LAYOUT = {
  simTime: 0, CA: 1, T: 2, Tj: 3, valve: 4, valveCmd: 5,
  k: 6, Qgen: 7, Qremoval: 8, pressure: 9, reliefFlow: 10,
  U: 11, rpm: 12, setpoint: 13, error: 14, Da: 15,
} as const;
export const SNAPSHOT_SIZE = 16;
```

Valider les commandes entrantes dans le worker (bornes, NaN). Un NaN dans l'état ⇒ pause automatique + événement `error`.

### 5.3 Abstraction de transport (prépare l'architecture B)

```ts
export interface SimulationTransport {
  send(cmd: WorkerCommand): void;
  onEvent(cb: (e: WorkerEvent) => void): () => void;
  dispose(): void;
}
// v1 : WorkerTransport. Futur : WebSocketTransport (même contrat).
```

### 5.4 Règles d'or de performance

1. **Jamais de `setState` à 60 Hz.** Le snapshot est copié dans `simRef.current` (Float64Array réutilisé). `useFrame` lit `simRef.current[SNAPSHOT_LAYOUT.T]` et écrit dans `material.uniforms.uTemperature.value`.
2. **Pas de temps physique fixe**, découplé du rendu (accumulateur §4.7). La physique ne doit pas dépendre d'un écran à 30, 60 ou 144 Hz.
3. **Zéro allocation dans les boucles chaudes** (RK4, `useFrame`, graphes) : buffers préalloués, pas de `new` / spread / `map` par frame.
4. Le HUD numérique (valeurs affichées en texte) se met à jour à **10 Hz** max via un intervalle qui écrit directement dans des `ref` DOM (`el.textContent = ...`), pas via React.
5. Zustand ne stocke que : paramètres, gains, mode, scénario actif, liste d'alarmes, état run/pause, `timeScale`, préférences UI.

### 5.5 Machine d'états de l'application

```
idle ──init──► ready ──start──► running ◄──► paused
                                  │
                       T > T_rupture
                                  ▼
                               ruptured ──reset──► ready
```

---

## 6. Structure des dossiers

```text
cstr-digital-twin/
├── .github/workflows/ci.yml
├── docs/
│   ├── decisions/                      # ADR supplémentaires
│   ├── model.md                        # Copie détaillée du §4 + dérivations
│   └── screenshots/
├── notebooks/                          # ÉQUIPE GÉNIE CHIMIQUE
│   ├── requirements.txt
│   ├── 01_model_validation.ipynb       # Intégration SciPy, états stationnaires
│   ├── 02_van_heerden.ipynb            # Courbes génération/évacuation, T_crit
│   ├── 03_pid_tuning.ipynb             # Ziegler-Nichols / IMC
│   ├── 04_scenarios.ipynb              # Réponses attendues des 4 scénarios
│   └── export_golden.py                # Génère tests/golden/*.json
├── public/
│   ├── hdri/industrial.hdr             # (léger, < 2 Mo)
│   └── models/                         # .glb optionnel (ADR-003)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Canvas 3D + HUD
│   │   ├── about/page.tsx              # Explication du projet
│   │   └── globals.css
│   ├── simulation/                     # CŒUR PHYSIQUE (aucun import React/Three ici)
│   │   ├── constants.ts                # Constantes physiques universelles (R, etc.)
│   │   ├── presets/
│   │   │   ├── seborgBenchmark.ts
│   │   │   └── propyleneOxide.ts       # Rempli par l'équipe chimie
│   │   ├── types.ts                    # ReactorParams, ReactorState, PidGains…
│   │   ├── kinetics.ts                 # Arrhenius, U(N), Antoine
│   │   ├── equations.ts                # derivatives(x, params, inputs, out)
│   │   ├── rk4.ts                      # Intégrateur générique sans allocation
│   │   ├── pid.ts                      # PID discret + anti-windup + bumpless
│   │   ├── relief.ts                   # Pression + soupape
│   │   ├── scenarios.ts                # Définition des 4 scénarios
│   │   ├── engine.ts                   # Classe SimulationEngine (pure, testable)
│   │   ├── protocol.ts                 # Contrat messages
│   │   ├── simulation.worker.ts        # Fine couche : boucle + messages → engine
│   │   ├── geometry.ts                 # Proportions du réacteur (H/D, turbine…)
│   │   └── __tests__/
│   ├── client/
│   │   ├── SimulationClient.ts         # Implémente SimulationTransport
│   │   ├── simRef.ts                   # Buffer partagé côté UI
│   │   └── telemetryBuffer.ts          # Ring buffers pour graphes
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── ReactorScene.tsx        # Canvas, lumières, Environment, Bloom
│   │   │   ├── ReactorVessel.tsx       # Cuve + coupe
│   │   │   ├── CoolingJacket.tsx
│   │   │   ├── Agitator.tsx            # Arbre + turbine Rushton
│   │   │   ├── Baffles.tsx
│   │   │   ├── ReliefValve.tsx
│   │   │   ├── Fluid.tsx
│   │   │   ├── shaders/
│   │   │   │   ├── fluid.vert.glsl
│   │   │   │   ├── fluid.frag.glsl
│   │   │   │   ├── jacket.frag.glsl
│   │   │   │   └── FluidMaterial.ts
│   │   │   ├── BubbleParticles.tsx
│   │   │   ├── SteamParticles.tsx
│   │   │   ├── VibrationRig.tsx        # Tremblement caméra/cuve
│   │   │   └── InspectionLabels.tsx    # <Html> + KaTeX
│   │   ├── scada/
│   │   │   ├── HudLayout.tsx
│   │   │   ├── ControlPanel.tsx
│   │   │   ├── PidPanel.tsx
│   │   │   ├── ModeToggle.tsx
│   │   │   ├── QuenchButton.tsx
│   │   │   ├── TelemetryCharts.tsx
│   │   │   ├── LiveReadouts.tsx        # Valeurs numériques 10 Hz
│   │   │   ├── AlarmBanner.tsx
│   │   │   ├── ScenarioSelector.tsx
│   │   │   └── TimeControls.tsx
│   │   ├── academic/
│   │   │   ├── TheoryDrawer.tsx
│   │   │   └── sheets/*.mdx            # Fiches explicatives
│   │   └── ui/                         # Boutons, sliders génériques
│   ├── store/
│   │   └── useReactorStore.ts
│   ├── hooks/
│   │   ├── useSimulation.ts
│   │   └── useThrottledReadout.ts
│   └── lib/
│       ├── units.ts                    # K↔°C, Pa↔bar, s↔min
│       ├── colorScale.ts               # Température → couleur (partagé shader/HUD)
│       └── presetsStorage.ts           # localStorage (+ Supabase option)
├── tests/
│   ├── golden/                         # Sorties Python de référence
│   └── e2e/                            # Playwright
├── CHANGELOG.md
├── next.config.ts
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

**Règle de dépendance** : `src/simulation/` n'importe **jamais** depuis `components/`, `store/`, `react` ou `three`. C'est un module pur, testable sous Node.

---

## 7. Plan de réalisation — Sprints 0 à 7

> Durée suggérée : sprints de **1 à 2 semaines** pour l'équipe humaine. Pour l'agent IA, chaque sprint = un lot de tâches à terminer entièrement.
> Préfixes : **C** = Génie Chimique (humain, Polytechnique), **L** = Génie Logiciel / 3D (agent IA + ÉTS), **T** = tâche de code générique.

---

### 🟦 Sprint 0 — Fondations du dépôt (½ semaine)

**Objectif** : un dépôt propre, outillé, déployé vide.

| ID | Tâche | Détails | Critère d'acceptation |
| --- | --- | --- | --- |
| S0-T01 | Initialiser Next.js | `pnpm create next-app` : TypeScript, App Router, Tailwind, ESLint, dossier `src/`, alias `@/*` | `pnpm dev` affiche une page |
| S0-T02 | TS strict | `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` | `pnpm typecheck` vert |
| S0-T03 | Prettier + scripts | Scripts : `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `format` | Tous les scripts existent |
| S0-T04 | Vitest | Config Node pour `src/simulation`, test bidon | `pnpm test` vert |
| S0-T05 | Playwright | Un test qui ouvre `/` et vérifie le titre | `pnpm test:e2e` vert |
| S0-T06 | CI GitHub Actions | lint → typecheck → test → build sur PR et `main` (§10) | Badge vert |
| S0-T07 | Vercel | Lier le repo, previews par PR | URL de preview fonctionnelle |
| S0-T08 | Arborescence | Créer tous les dossiers du §6 avec `index.ts` ou `.gitkeep` | Arborescence conforme |
| S0-T09 | Docs | `CHANGELOG.md`, `docs/decisions/` avec ADR-001 à 005 copiés | Fichiers présents |
| S0-T10 | Notebooks | `notebooks/requirements.txt` (numpy, scipy, matplotlib, jupyter, pandas) | `pip install -r` OK |

**DoD Sprint 0** : page « CSTR Digital Twin — coming soon » en ligne sur Vercel, CI verte.

---

### 🟩 Sprint 1 — Cadrage thermodynamique & modèle validé hors ligne

**Objectif** : prouver mathématiquement le comportement (stationnaires multiples, emballement) et figer le contrat de types.

#### Génie Chimique

| ID | Tâche | Livrable |
| --- | --- | --- |
| S1-C01 | Choisir la réaction de référence réelle et extraire de la littérature : E_a, k₀, ΔH_r, ρ, C_p, U, A, V, μ (avec références) | `docs/model.md` §Paramètres + `presets/propyleneOxide.ts` (valeurs) |
| S1-C02 | Notebook 01 : intégrer le modèle niveau 1 avec `scipy.integrate.solve_ivp` (méthode `Radau` ou `LSODA`) pour les deux jeux de paramètres | Courbes C_A(t), T(t) |
| S1-C03 | Notebook 02 : diagramme de Van Heerden (Q_gén(T) et Q_évac(T)), trouver les 1 à 3 états stationnaires, leur stabilité (valeurs propres du jacobien), et T_crit | Figure + tableau des stationnaires |
| S1-C04 | Dimensionner l'enveloppe (V_j, F_c,max, T_c,in) pour que la vanne à ~50 % maintienne le point nominal | Valeurs pour le niveau 2 |
| S1-C05 | `export_golden.py` : exporter 5 trajectoires de référence (JSON : t, C_A, T, T_j) | `tests/golden/*.json` |

#### Génie Logiciel

| ID | Tâche | Détails | Critère |
| --- | --- | --- | --- |
| S1-L01 | `types.ts` | `ReactorParams`, `ReactorState`, `PidGains`, `Inputs`, `ScenarioId`, `AlarmEvent` — chaque champ commenté avec son unité | Compile |
| S1-L02 | `constants.ts` + `presets/seborgBenchmark.ts` | Valeurs du §4.6 | Tests de cohérence : `k(350) ≈ 1/60 s⁻¹` (±1 %) |
| S1-L03 | `protocol.ts` | Contrat §5.2 + fonctions `encodeSnapshot` / `decodeSnapshot` | Test aller-retour |
| S1-L04 | `useReactorStore.ts` (squelette) | État lent uniquement (§5.4.5) | Test d'actions |
| S1-L05 | Squelette worker | Répond `pong` à `ping`, chargé via `new URL('./simulation.worker.ts', import.meta.url)` | Visible dans l'app (dev + build Vercel) |
| S1-L06 | `units.ts` | K↔°C, Pa↔bar, s↔min, mol/L | Tests unitaires |

**DoD Sprint 1** : notebooks montrant l'emballement ; types figés ; worker qui répond en production.

---

### 🟨 Sprint 2 — Moteur RK4 à 60 Hz & régulation PID

**Objectif** : un moteur physique complet, testé contre Python, piloté par un PID robuste.

#### Génie Chimique

| ID | Tâche | Livrable |
| --- | --- | --- |
| S2-C01 | Bornes physiques des actionneurs : v ∈ [0,1], τ_v, r_max, T_c,in min (ex. ≥ 5 °C) | Valeurs dans le preset |
| S2-C02 | Accord PID initial (Ziegler-Nichols en boucle fermée **et** IMC), comparer dans le notebook 03 | K_p, K_i, K_d, τ_f recommandés |
| S2-C03 | Définir les seuils d'alarmes (H, HH, LL) et T_rupture | Tableau dans `docs/model.md` |

#### Génie Logiciel

| ID | Tâche | Détails | Critère |
| --- | --- | --- | --- |
| S2-L01 | `kinetics.ts` | `arrhenius(T, k0, EaR)`, `heatTransferCoeff(N, …)`, `antoineWaterPa(T)` | Tests vs valeurs tabulées |
| S2-L02 | `equations.ts` | `derivatives(x: Float64Array, p, inputs, out: Float64Array): void` — sans allocation ; niveaux 1 et 2 | Au point (0.5, 350, T_c=300), dérivées ≈ 0 (< 1e-4) |
| S2-L03 | `rk4.ts` | Intégrateur générique avec buffers k1..k4 préalloués | Test : dy/dt = −y, erreur à t=1 < 1e-9 avec dt=0.01 ; ordre 4 vérifié (diviser dt par 2 ⇒ erreur ÷ ~16) |
| S2-L04 | Garde-fous numériques | Clamp C_A ≥ 0, détection NaN/Infinity ⇒ état `error` | Test |
| S2-L05 | `pid.ts` | Classe `PidController` : positionnelle, dérivée sur mesure filtrée, anti-windup par clamping, bumpless, `reset()` | Tests : (a) step de consigne sans kick dérivé ; (b) vanne saturée 30 s ⇒ intégrale ne croît pas ; (c) bascule Manuel→Auto sans saut |
| S2-L06 | `engine.ts` | `SimulationEngine` : `step(realDtSeconds)` avec accumulateur, `timeScale`, cadence PID 0.1 s, plafond de pas | Tests déterministes |
| S2-L07 | Tests golden | Comparer moteur TS aux trajectoires Python (`tests/golden`) | Erreur relative max < 0.5 % sur T |
| S2-L08 | Test de stabilité ouverte | Niveau 1, PID off, perturbation +0.5 K ⇒ divergence (le point est instable) | Test passe |
| S2-L09 | Test de régulation | Niveau 2, PID on, perturbation ⇒ retour à ±1 K de la consigne en < 300 s simulées | Test passe |
| S2-L10 | Worker réel | Boucle `setInterval(16)` mesurant le temps réel via `performance.now()`, envoi snapshot transférable | Snapshots reçus à 55–65 Hz |
| S2-L11 | `SimulationClient` + `simRef` | Implémente `SimulationTransport`, recopie dans `simRef` | — |
| S2-L12 | Page debug `/debug` | Tableau texte des valeurs (10 Hz), boutons start/pause/reset, slider timeScale | Le réacteur passe de stable à emballement en changeant T_c / panne pompe |

**DoD Sprint 2** : moteur testé (couverture `src/simulation` ≥ 90 %), page `/debug` démontrant stabilité et emballement.

---

### 🟧 Sprint 3 — Scène 3D du réacteur CSTR

**Objectif** : le jumeau numérique 3D en coupe, lié au moteur.

#### Génie Chimique

| ID | Tâche | Livrable |
| --- | --- | --- |
| S3-C01 | Proportions géométriques standard : H/D (≈ 1), D_turbine/D_cuve (≈ 1/3), hauteur turbine (≈ D/3 du fond), 4 chicanes de largeur D/10–D/12, épaisseur d'enveloppe, position soupape, buses d'entrée/sortie | `src/simulation/geometry.ts` (valeurs normalisées par D) |

#### Génie Logiciel

| ID | Tâche | Détails | Critère |
| --- | --- | --- | --- |
| S3-L01 | `ReactorScene.tsx` | `<Canvas>` (dpr [1, 2], antialias), `OrbitControls` bornés (pas sous le sol), `Environment` HDRI industriel, lumière directionnelle + ombres douces, sol | Scène visible |
| S3-L02 | `ReactorVessel.tsx` | Cuve via `LatheGeometry` (fond bombé type Klöpper / elliptique), matériau métal brossé (`meshStandardMaterial`, metalness 0.9, roughness 0.35), coupe 90° (`thetaLength = 1.5π` + faces de coupe colorées) | Intérieur visible |
| S3-L03 | `CoolingJacket.tsx` | Coque externe concentrique, coupe identique, espace annulaire visible | Enveloppe visible en coupe |
| S3-L04 | `Agitator.tsx` | Arbre + moyeu + disque + 6 pales (turbine Rushton) + moteur en haut | Proportions fidèles à `geometry.ts` |
| S3-L05 | `Baffles.tsx`, `ReliefValve.tsx`, tuyauterie | Chicanes, soupape sur le couvercle, buses entrée/sortie, tuyaux d'enveloppe | — |
| S3-L06 | Liaison RPM | `useFrame((_, delta) => shaft.rotation.y += rpm * 2π/60 * delta * visualFactor)` en lisant `simRef` | Rotation proportionnelle, aucun re-rendu React (vérifier avec React DevTools Profiler) |
| S3-L07 | Fluide (placeholder) | Cylindre intérieur, couleur via `colorScale.ts` mise à jour dans `useFrame` | Change de couleur avec T |
| S3-L08 | Layout page | Canvas plein écran, HUD (vide) superposé, responsive | — |
| S3-L09 | `leva` en dev | Panneau de réglage caméra / matériaux, exclu du build prod | Absent du bundle prod |
| S3-L10 | Bouton « Vue coupe / Vue complète » | Bascule l'angle de la coupe | — |

**DoD Sprint 3** : réacteur 3D interactif, agitateur synchronisé au moteur, ≥ 60 FPS sur un portable récent.

---

### 🟥 Sprint 4 — Shaders thermiques, fluide, soupape de vapeur

**Objectif** : traduire visuellement la thermodynamique sur le GPU.

#### Génie Chimique

| ID | Tâche | Livrable |
| --- | --- | --- |
| S4-C01 | Valider la corrélation U(N) (exposant, U_min) et l'effet visuel attendu quand l'agitation ralentit | Paramètres |
| S4-C02 | Valider/simplifier le modèle pression + soupape (§4.4) : P_tarage, C_d, A_s, L_v | Paramètres + note |

#### Génie Logiciel

| ID | Tâche | Détails | Critère |
| --- | --- | --- | --- |
| S4-L01 | `colorScale.ts` | Rampe partagée JS/GLSL : 300 K bleu/cyan → 330 K vert-jaune → 360 K orange → ≥ 400 K rouge incandescent (émission > 1 pour déclencher le Bloom) | Tests des points de contrôle |
| S4-L02 | `fluid.vert.glsl` | Surface libre : creusement en vortex `h(r) = −depth · (1 − (r/R)²)` avec `depth ∝ rpm²` (borné) ; ondulation bruitée (simplex noise) dont l'amplitude ∝ ébullition | Vortex visible, proportionnel aux RPM |
| S4-L03 | `fluid.frag.glsl` | Uniforms : `uTemperature`, `uTime`, `uRpm`, `uBoiling` ; couleur via rampe, fresnel, émission pour T élevée, léger gradient radial | Transition fluide sans saut |
| S4-L04 | `jacket.frag.glsl` | Couleur selon T_j ; motif d'écoulement animé (bandes défilant à vitesse ∝ F_c) ; figé si pompe en panne | Visible en coupe |
| S4-L05 | Post-processing | `EffectComposer` + `Bloom` (luminanceThreshold ~0.9, mipmapBlur) + `Vignette` | Bloom uniquement au-delà de ~400 K |
| S4-L06 | `BubbleParticles.tsx` | `InstancedMesh` (≤ 2000 instances), trajectoires hélicoïdales autour de l'arbre (vitesse ∝ RPM), densité ∝ (T − T_ébullition)⁺ | Pas d'allocation par frame |
| S4-L07 | `SteamParticles.tsx` | `Points` + shader de sprite doux, émission ∝ `reliefFlow`, montée + dispersion + fade | Panache à l'ouverture de soupape |
| S4-L08 | `VibrationRig.tsx` | Tremblement de la cuve et de la caméra ∝ (T − T_HH)⁺ et ∝ pression | Discret à l'approche, fort près de la rupture |
| S4-L09 | État « rupture » | Écran figé, flash, overlay « Perte de confinement — T = … K à t = … », bouton Réessayer | — |
| S4-L10 | Couplage U(N) et soupape dans le moteur | Ajouter les termes au moteur + tests | Baisser RPM ⇒ T monte (test) |

**DoD Sprint 4** : le réacteur change de couleur, bouillonne, vibre et relâche un panache de vapeur ; 60 FPS maintenus.

---

### 🟪 Sprint 5 — Poste de contrôle SCADA & « chaos engineering » chimique

**Objectif** : simulateur complet, jouable, pilotable.

#### Génie Chimique

| ID | Tâche | Livrable |
| --- | --- | --- |
| S5-C01 | Finaliser les 4 scénarios (§4.8) : conditions initiales, chronologie d'événements, objectifs pédagogiques, « solution » attendue | `scenarios.ts` (données) + fiche texte |
| S5-C02 | Paramètres du quench (V_q, T_q, inhibiteur) | Valeurs |
| S5-C03 | Recette : jouer chaque scénario et valider le réalisme | Rapport court |

#### Génie Logiciel

| ID | Tâche | Détails | Critère |
| --- | --- | --- | --- |
| S5-L01 | Design SCADA | Thème sombre industriel (gris anthracite, accents cyan/ambre/rouge), police monospace pour les valeurs, conformité aux codes couleurs d'alarme (ISA-18.2 / ISA-101 en inspiration) | Cohérent, lisible |
| S5-L02 | `ControlPanel.tsx` | Sliders T_in, C_A,in, F, RPM, avec saisie numérique, unités affichées, bornes du preset | Commande → worker en < 1 frame |
| S5-L03 | `PidPanel.tsx` + `ModeToggle.tsx` | K_p, K_i, K_d, consigne ; Manuel (slider vanne) / Auto ; bumpless | Bascule sans à-coup |
| S5-L04 | `LiveReadouts.tsx` | Valeurs T, T_j, C_A, vanne %, P, Da à 10 Hz via refs DOM | Pas de re-rendu React (Profiler) |
| S5-L05 | `TelemetryCharts.tsx` | uPlot, fenêtre glissante (60 s simulées par défaut, réglable) : (1) T et consigne, (2) C_A, (3) vanne cmd vs réelle, (4) Q_gén vs Q_évac ; ring buffers préalloués, redessin dans un rAF propre | 60 FPS avec 4 graphes |
| S5-L06 | `AlarmBanner.tsx` | Alarmes H/HH/LL, clignotement, acquittement, historique horodaté (temps simulé) | — |
| S5-L07 | `QuenchButton.tsx` | Bouton rouge à couvercle (2 clics : armer puis déclencher), délai d'injection | Peut sauver le scénario 2 |
| S5-L08 | `ScenarioSelector.tsx` | Liste, description, objectifs ; chargement = reset + init + script d'événements | Les 4 scénarios jouables |
| S5-L09 | `TimeControls.tsx` | Play/Pause/Reset, ×1/×5/×10/×30/×60, temps simulé affiché | — |
| S5-L10 | Raccourcis clavier | Espace = pause, Q = armer quench, R = reset, 1–4 = scénarios | — |
| S5-L11 | Presets | Sauvegarder/charger un jeu de paramètres (localStorage, try/catch), export/import JSON | Survit au rechargement |
| S5-L12 | E2E Playwright | Charger scénario 2 → attendre alarme HH → quench → vérifier non-rupture | Test vert |

**DoD Sprint 5** : simulateur complet jouable de bout en bout.

---

### ⬛ Sprint 6 — Mode « Inspection académique »

**Objectif** : la valeur pédagogique pour les professeurs et la vitrine pour les recruteurs.

#### Génie Chimique

| ID | Tâche | Livrable |
| --- | --- | --- |
| S6-C01 | Rédiger les fiches : bilans matière/énergie, Arrhenius, Van Heerden & multiplicité, Damköhler, stabilité, PID & windup, sécurité procédés (soupape, quench) | `components/academic/sheets/*.mdx` |
| S6-C02 | Audit des unités SI sur toute l'interface | Liste de corrections |

#### Génie Logiciel

| ID | Tâche | Détails | Critère |
| --- | --- | --- | --- |
| S6-L01 | `InspectionLabels.tsx` | `<Html>` de drei ancrés sur cuve, enveloppe, turbine, soupape, entrée ; formule KaTeX + valeur vivante (10 Hz) | Lisibles, suivent la caméra, occlusion gérée |
| S6-L02 | Bascule mode Inspection | Atténue les effets, affiche étiquettes et panneau latéral | — |
| S6-L03 | `TheoryDrawer.tsx` | Tiroir latéral avec les fiches MDX, liens depuis chaque étiquette | — |
| S6-L04 | Graphe de Van Heerden en direct | Q_gén(T) et Q_évac(T) calculés pour les paramètres courants (balayage de T côté UI, 200 points, recalcul uniquement quand les paramètres changent) + point de fonctionnement animé | Les stationnaires bougent quand on change UA ou T_c |
| S6-L05 | Page `/about` | Équipe, architecture, modèle, liens GitHub | — |
| S6-L06 | Accessibilité | Contraste AA du HUD, navigation clavier, `aria-label`, alternative textuelle des alarmes, option « réduire les animations » (désactive vibrations/flash) | Lighthouse Accessibilité ≥ 90 |
| S6-L07 | i18n FR/EN (optionnel) | Dictionnaire simple, FR par défaut | — |

**DoD Sprint 6** : mode Inspection complet, fiches validées par l'équipe chimie.

---

### 🚀 Sprint 7 — Optimisation, robustesse & mise en production

**Objectif** : une app de production stable, rapide, présentable.

| ID | Tâche | Détails | Critère |
| --- | --- | --- | --- |
| S7-L01 | Audit perf GPU | `r3f-perf` : draw calls < 100, triangles < 300k, pas de fuite (`renderer.info.memory` stable sur 10 min) | Rapport dans `docs/perf.md` |
| S7-L02 | Qualité adaptative | `PerformanceMonitor` de drei : baisse dpr / désactive Bloom / réduit particules si FPS < 50 | Fluide sur portable d'entrée de gamme |
| S7-L03 | Chargement | Canvas en `dynamic(() => import(...), { ssr: false })`, écran de chargement, HDRI compressé, bundle JS initial < 500 ko gzip (hors three) | Lighthouse Performance ≥ 80 |
| S7-L04 | Onglet en arrière-plan | `visibilitychange` ⇒ pause auto du worker (option) | Pas de spirale de pas au retour |
| S7-L05 | Gestion d'erreurs | Error boundary autour du Canvas, détection WebGL indisponible ⇒ message + mode 2D (graphes seuls) | — |
| S7-L06 | `SharedArrayBuffer` (optionnel) | Seulement si le profilage montre un coût `postMessage` significatif ; en-têtes COOP/COEP dans `next.config.ts` ; vérifier que HDRI et polices chargent encore | ADR mis à jour |
| S7-L07 | Supabase (optionnel) | Table `presets` (id, name, params jsonb, created_at), lecture publique, écriture anonyme limitée ; variables d'env sur Vercel | Partage d'un preset par lien `?preset=id` |
| S7-L08 | SEO & partage | Métadonnées, image Open Graph (capture du réacteur), favicon | Aperçu correct sur LinkedIn |
| S7-L09 | Domaine personnalisé | Configurer dans Vercel (DNS), HTTPS | URL finale |
| S7-L10 | README final & démo | Captures, GIF de démo, section « Lancer en local », crédits | — |
| S7-L11 | Tag `v1.0.0` | Release GitHub + CHANGELOG | — |

**DoD Sprint 7** : application en production sur Vercel, prête pour portfolio et démonstrations.

---

### 📅 Vue d'ensemble

| Sprint | Thème | Livrable démontrable |
| --- | --- | --- |
| 0 | Fondations | Page vide en ligne, CI verte |
| 1 | Modèle validé | Notebooks d'emballement, types figés |
| 2 | Moteur + PID | Page `/debug` : stable ↔ emballement |
| 3 | Scène 3D | Réacteur en coupe, agitateur synchronisé |
| 4 | Shaders & effets | Couleurs thermiques, bulles, vapeur, vibrations |
| 5 | SCADA & scénarios | Simulateur jouable de bout en bout |
| 6 | Inspection académique | Étiquettes vivantes, fiches, Van Heerden live |
| 7 | Production | v1.0.0 sur domaine personnalisé |

---

## 8. Stratégie de tests

### 8.1 Pyramide

| Niveau | Outil | Cible | Couverture visée |
| --- | --- | --- | --- |
| Unitaire | Vitest | `src/simulation/**`, `src/lib/**` | ≥ 90 % |
| Intégration | Vitest | `SimulationEngine` sur scénarios complets (sans worker) | 4 scénarios |
| Validation scientifique | Vitest + golden Python | Écart TS vs SciPy | < 0.5 % |
| E2E | Playwright | Parcours utilisateur, scénario 2 + quench | Parcours clés |
| Fumée perf | Playwright | Mesure FPS moyen sur 10 s (via `requestAnimationFrame` injecté) en CI | ≥ 30 FPS en headless (seuil indicatif) |

### 8.2 Tests de validation scientifique obligatoires

1. **Ordre de RK4** : erreur globale ∝ dt⁴.
2. **État stationnaire** : dérivées nulles au point du benchmark.
3. **Instabilité en boucle ouverte** du point (0.5 mol/L, 350 K) au niveau 1.
4. **Conservation** : à k₀ = 0 et sans échange thermique, C_A et T tendent vers les valeurs d'entrée avec la constante de temps τ = V/F.
5. **Golden** : trajectoires Python ↔ TS.
6. **Anti-windup** : comparaison avec/sans clamping lors d'une saturation prolongée (dépassement réduit).
7. **Indépendance au framerate** : appeler `engine.step` avec des dt réels de 1/30, 1/60, 1/144 s ⇒ même état à t = 60 s simulées (écart < 1e-9).

---

## 9. Budget de performance

| Indicateur | Cible |
| --- | --- |
| FPS (portable récent, 1080p) | 60 constants |
| FPS (portable d'entrée de gamme) | ≥ 45 avec qualité adaptative |
| Temps worker par tick | < 2 ms |
| Temps `useFrame` total | < 4 ms |
| Draw calls | < 100 |
| Mémoire GPU | Stable sur 10 min |
| JS initial (gzip, hors three/R3F chargés en différé) | < 500 ko |
| Time to Interactive | < 4 s sur connexion 4G |

---

## 10. CI/CD & déploiement Vercel

### 10.1 GitHub Actions (`.github/workflows/ci.yml`)

Étapes sur chaque PR et `main` :
1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test -- --coverage`
5. `pnpm build`
6. `pnpm test:e2e` (installe les navigateurs Playwright)

### 10.2 Vercel

- Framework preset : Next.js. Build : `pnpm build`.
- Chaque PR ⇒ URL de preview (à coller dans la PR).
- `main` ⇒ production.
- Variables d'environnement (si Supabase) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Vérifier que le **worker est bien émis comme chunk séparé** au build (tester sur la preview, pas seulement en `dev`).

### 10.3 Branches

- `main` protégé (CI verte obligatoire).
- `feat/S2-L05-pid`, `fix/...`, `docs/...`.
- Squash merge, titre de PR = Conventional Commit.

---

## 11. Conventions de code

- **Nommage** : composants `PascalCase.tsx`, utilitaires `camelCase.ts`, constantes `UPPER_SNAKE_CASE`.
- **Variables physiques** : noms explicites + unité en suffixe si ambigu (`tempK`, `pressurePa`, `flowLps`). Dans les équations, les noms courts (`CA`, `T`, `Tj`) sont acceptés **avec** un commentaire de référence au §4.3.
- **Fonctions pures** dans `src/simulation` ; pas d'effets de bord hors `engine.ts`.
- **Commentaires** : expliquer le *pourquoi* ; chaque équation référencée (« Bilan d'énergie, README §4.3 »).
- **Shaders** : fichiers `.glsl` séparés, importés comme chaînes (configurer le loader webpack/turbopack `raw` ou utiliser des template strings dans un `.ts`). Uniforms préfixés `u`, varyings préfixés `v`.
- **Pas de magie** : aucun nombre littéral dans les composants 3D hors `geometry.ts` / constantes de style.

---

## 12. Risques & parades

| Risque | Impact | Parade |
| --- | --- | --- |
| Raideur numérique lors de l'emballement (Arrhenius) | Divergence / NaN | RK4 à dt = 0.01 s ; test aux T extrêmes ; sous-pas adaptatif si |dT| > 5 K par pas ; garde NaN |
| Constantes réelles non fournies à temps | Blocage | Benchmark Seborg par défaut (§4.6) |
| Incompatibilité versions R3F / React | Build cassé | Vérification S0, versions figées |
| Worker non bundlé en prod | App morte sur Vercel | Test de preview dès S1-L05 |
| Re-rendus React à 60 Hz | Chute FPS | Règles §5.4 + revue Profiler à chaque sprint |
| GPU faible | Saccades | Qualité adaptative S7-L02 |
| Modèle de pression trop simpliste pour un jury de génie chimique | Crédibilité | Le documenter honnêtement comme simplification dans les fiches (S6-C01) |
| Dérive du périmètre | Retard | Tout ajout va au §13 tant que la v1 n'est pas taguée |

---

## 13. Backlog d'extensions (post-v1)

1. **Architecture B** : moteur en Python FastAPI ou Go dans un conteneur Docker (Railway, Fly.io ou VPS OVHcloud), diffusion via WebSockets binaires, implémentation de `WebSocketTransport` (même contrat §5.2). Permet un mode « salle de contrôle partagée » multi-utilisateurs.
2. **Moteur Rust → WebAssembly** (`wasm-pack`) appelé depuis le worker ; benchmark vs TS.
3. **Réactions multiples / série A → B → C** avec sélectivité.
4. **Réacteur batch et semi-batch** (ajout contrôlé de réactif).
5. **Contrôle avancé** : cascade (T réacteur → T enveloppe), feedforward, MPC simplifié.
6. **Mode examen** : défis notés (« stabiliser en moins de X s », « sauver le réacteur avec le moins de diluant »), classement Supabase.
7. **Enregistrement / relecture** d'une session (rejouer la télémétrie).
8. **Export CSV** des courbes.
9. **Modèle `.glb`** réalisé sous Blender par un humain.
10. **Réalité virtuelle** via `@react-three/xr`.

---

## 14. Glossaire

| Terme | Définition |
| --- | --- |
| **CSTR** | Continuous Stirred-Tank Reactor — réacteur continu parfaitement agité |
| **Emballement thermique** | Boucle positive : T ↑ ⇒ k(T) ↑ ⇒ chaleur générée ↑ ⇒ T ↑ |
| **Diagramme de Van Heerden** | Tracé de la chaleur générée et évacuée en fonction de T ; les intersections sont les états stationnaires |
| **Damköhler (Da)** | Rapport temps de séjour / temps de réaction |
| **RK4** | Runge-Kutta d'ordre 4, intégrateur explicite d'EDO |
| **PID** | Régulateur Proportionnel-Intégral-Dérivé |
| **Anti-windup** | Mécanisme empêchant l'intégrale du PID de croître quand l'actionneur est saturé |
| **Bumpless transfer** | Passage Manuel → Auto sans saut de la commande |
| **Quench** | Arrêt d'urgence par injection d'un diluant froid ou d'un inhibiteur |
| **Turbine Rushton** | Agitateur à disque et 6 pales droites, standard industriel |
| **Chicanes (baffles)** | Plaques verticales empêchant la mise en rotation globale du liquide |
| **Double enveloppe** | Paroi externe où circule le fluide de refroidissement |
| **SCADA** | Supervisory Control And Data Acquisition — interface de supervision industrielle |
| **Transient update** | Lecture/écriture d'état hors du cycle de rendu React |
| **Golden test** | Test comparant une sortie à une référence validée (ici : Python/SciPy) |

---

## ▶️ Lancer en local

```bash
# Application
pnpm install
pnpm dev            # http://localhost:3000
pnpm test           # tests unitaires
pnpm test:e2e       # tests de bout en bout

# Notebooks (équipe Génie Chimique)
cd notebooks
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
jupyter lab
python export_golden.py   # régénère tests/golden/
```

---

*Projet Polytechnique Montréal × ÉTS — Licence : à définir (MIT recommandée pour un portfolio).*
