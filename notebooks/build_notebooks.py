"""Construit les quatre notebooks du projet (nbformat) puis les exécute.

Les notebooks sont générés depuis ce fichier pour rester versionnables et relisibles en revue.
Usage :  python build_notebooks.py        (depuis le dossier notebooks/, venv activé)
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import nbformat as nbf

HERE = Path(__file__).resolve().parent

SETUP = '''import sys, json
sys.path.insert(0, ".")
import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
from pathlib import Path
from scipy.integrate import solve_ivp

from cstr_model import (Params, Inputs, rhs, arrhenius, UA_eff, steady_states_level1,
                        jacobian_level1, R_GAS, p_sat_water, relief_heat)
from presets_py import seborg, propylene_oxide
from pid_sim import (Pid, closed_loop, linearize, steady_state_level2, closed_loop_spectral_abscissa,
                     search_gains, max_recoverable_perturbation, step_metrics)

plt.rcParams.update({"figure.dpi": 110, "axes.grid": True, "grid.alpha": 0.3,
                     "axes.spines.top": False, "axes.spines.right": False})
GOLDEN = Path("..") / "tests" / "golden"
'''


def nb(cells):
    book = nbf.v4.new_notebook()
    book.metadata["kernelspec"] = {"display_name": "Python 3", "language": "python", "name": "python3"}
    book.cells = [nbf.v4.new_markdown_cell(c) if kind == "md" else nbf.v4.new_code_cell(c) for kind, c in cells]
    return book


# =================================================================================================
# 01 — Validation du modèle
# =================================================================================================
NB01 = [
    ("md", """# 01 — Validation du modèle CSTR (S1-C02)

**Objectif.** Intégrer le modèle de niveau 1 `[C_A, T]` avec `scipy.integrate.solve_ivp` pour les **deux jeux de paramètres** (benchmark de Seborg et hydrolyse de l'oxyde de propylène), établir les états stationnaires et leur stabilité, et vérifier que le moteur TypeScript reproduit ces trajectoires.

Équations (README §4.3, unités moteur : s, K, mol/L, L, g/L, J, W) :

$$\\frac{dC_A}{dt} = \\frac{F}{V}(C_{A,in}-C_A) - k(T)C_A,\\qquad
\\frac{dT}{dt} = \\frac{F\\rho C_p (T_{in}-T) + (-\\Delta H_r)\\,k(T)\\,C_A V - UA\\,(T-T_c)}{V\\rho C_p + C_w}$$

avec $k(T)=k_0 e^{-E_a/RT}$. $C_w$ est la capacité thermique de la paroi de cuve (acier) : elle ralentit la dynamique **sans changer les états stationnaires**."""),
    ("code", SETUP),
    ("md", "## 1. Les deux jeux de paramètres"),
    ("code", '''presets = {"Seborg (benchmark)": seborg().with_(level=1),
           "Oxyde de propylène (Fogler)": propylene_oxide().with_(level=1)}
rows = []
for name, p in presets.items():
    rows.append((name, p.V, p.F, p.CAin, p.Tin, p.k0, p.EaR, p.dHr/1e3, p.UAref, p.Tc,
                 -p.dHr * p.CAin / (p.rho * p.cp)))
import pandas as pd
pd.DataFrame(rows, columns=["jeu", "V [L]", "F [L/s]", "C_A,in [mol/L]", "T_in [K]", "k0 [1/s]",
                            "Ea/R [K]", "ΔH [kJ/mol]", "UA [W/K]", "Tc [K]", "ΔT_ad [K]"]).set_index("jeu").T'''),
    ("md", """## 2. États stationnaires et stabilité

Les états stationnaires du niveau 1 sont les racines de $g(T)=0$ où $C_A$ est ramené à sa valeur quasi-stationnaire $C_A(T) = \\frac{F/V\\,C_{A,in}}{F/V + k(T)}$. La stabilité vient des valeurs propres du jacobien (en min⁻¹)."""),
    ("code", '''for name, p in presets.items():
    print(f"=== {name} ===")
    for ca, T in steady_states_level1(p):
        ev = np.linalg.eigvals(jacobian_level1(p, [ca, T, p.Tc, 0.0])) * 60
        kind = "stable" if ev.real.max() < 0 else "INSTABLE"
        print(f"  C_A = {ca:7.4f} mol/L   T = {T:8.3f} K   valeurs propres (min⁻¹) = "
              f"{np.round(ev, 3)}   → {kind}")'''),
    ("md", """**Lecture.** Le benchmark de Seborg a trois états stationnaires : 324,5 K (stable, faible conversion), **350 K (instable, point de fonctionnement du plan)** et 369,7 K (haut). La valeur propre instable vaut $+2{,}83$ min⁻¹ pour le benchmark d'origine (sans paroi, état haut = foyer instable) ; avec la capacité thermique de paroi ajoutée au modèle elle passe à **+0,42 min⁻¹** (dynamique ≈ 7× plus lente) et l'état haut devient **stable** : la bistabilité 324,5 K / 369,7 K est visible en §3.

L'hydrolyse de l'oxyde de propylène présente aussi 3 états stationnaires, avec un point milieu instable à 326,8 K."""),
    ("md", "## 3. Trajectoires (Radau) — emballement et extinction"),
    ("code", '''def traj(p, x0, t_end):
    sol = solve_ivp(lambda t, y: rhs([y[0], y[1], p.Tc, 0.0], p, Inputs())[:2], (0, t_end), x0,
                    method="Radau", rtol=1e-9, atol=1e-11, dense_output=True)
    t = np.linspace(0, t_end, 1500)
    return t, sol.sol(t)

fig, axes = plt.subplots(2, 2, figsize=(11, 6.5), sharex="col")
for col, (name, p, t_end, dT) in enumerate([
        ("Seborg", presets["Seborg (benchmark)"], 1200, 0.5),
        ("Oxyde de propylène", presets["Oxyde de propylène (Fogler)"], 1500, 0.3)]):
    ca_m, T_m = steady_states_level1(p)[1]
    for sign, color in [(+1, "tab:red"), (-1, "tab:blue")]:
        t, y = traj(p, [ca_m, T_m + sign * dT], t_end)
        axes[0, col].plot(t, y[1], color=color, label=f"{sign * dT:+.1f} K")
        axes[1, col].plot(t, y[0], color=color)
    axes[0, col].axhline(T_m, color="k", lw=0.8, ls="--")
    axes[0, col].set(title=f"{name} — perturbation du point instable", ylabel="T [K]")
    axes[1, col].set(xlabel="t [s]", ylabel="C_A [mol/L]")
    axes[0, col].legend()
fig.tight_layout()'''),
    ("md", """Une perturbation de $\\pm$0,3–0,5 K sur l'état instable est amplifiée : le réacteur bascule vers l'état stationnaire haut (allumage, courbes rouges) ou bas (extinction, courbes bleues). C'est la multiplicité d'états stationnaires.

## 4. Plan de phase (Seborg)"""),
    ("code", '''p = presets["Seborg (benchmark)"]
fig, ax = plt.subplots(figsize=(6.5, 5))
for ca0 in np.linspace(0.02, 0.98, 8):
    for T0 in (300, 330, 360, 390):
        sol = solve_ivp(lambda t, y: rhs([y[0], y[1], p.Tc, 0.0], p, Inputs())[:2], (0, 2500),
                        [ca0, T0], method="LSODA", rtol=1e-8, atol=1e-10)
        ax.plot(sol.y[0], sol.y[1], lw=0.7, alpha=0.6, color="tab:gray")
for (ca, T), mk in zip(steady_states_level1(p), ["o", "X", "o"]):
    ax.plot(ca, T, mk, ms=9, color="tab:red" if mk == "X" else "tab:green")
ax.set(xlabel="C_A [mol/L]", ylabel="T [K]", title="Plan de phase — ● stable, ✖ instable (selle)")
fig.tight_layout()'''),
    ("md", """## 5. Vérification croisée avec le moteur TypeScript

`export_golden.py` écrit des trajectoires SciPy de référence dans `tests/golden/`. Le test Vitest `golden.test.ts` rejoue chacune avec le moteur RK4 (pas 0,01 s) et exige une erreur relative sur T inférieure à 0,5 % (exigence du plan) — l'écart réel mesuré est **< 3·10⁻⁸**. Ci-dessous, une re-simulation indépendante avec Radau rejoue les fichiers golden (contrôle de l'intégrateur de référence lui-même)."""),
    ("code", '''import warnings
rows = []
for f in sorted(GOLDEN.glob("*.json")):
    g = json.loads(f.read_text())
    P = g["params"]
    if g["preset"] == "seborg":
        base = seborg()
    else:
        base = propylene_oxide()
    p = base.with_(level=P["modelLevel"], rpm=P["rpm"], F=P["feedFlowLps"])
    u = Inputs(valve_cmd=g["valveCmd"])
    events = sorted((e["t"], e["set"]) for e in g["events"])
    x = np.array([g["initialState"][k] for k in ("CA", "T", "Tj", "v")])
    t_grid = np.array(g["t"]); T_ref = np.array(g["T"]); out = [x[1]]
    t_prev, ei = 0.0, 0
    inv = {"pumpEfficiency": "pump_eff", "fouling": "fouling", "inhibitorFactor": "inhibitor", "feedFactor": "feed_factor"}
    for tg in t_grid[1:]:
        while ei < len(events) and events[ei][0] <= t_prev + 1e-12:
            for k, v in events[ei][1].items(): setattr(u, inv[k], v)
            ei += 1
        seg_end = tg
        if ei < len(events) and events[ei][0] < tg:
            # intégrer jusqu'à l'événement puis continuer
            sol = solve_ivp(lambda tt, y: rhs(y, p, u), (t_prev, events[ei][0]), x, method="Radau", rtol=1e-10, atol=1e-12)
            x = sol.y[:, -1]; t_prev = events[ei][0]
            for k, v in events[ei][1].items(): setattr(u, inv[k], v)
            ei += 1
        sol = solve_ivp(lambda tt, y: rhs(y, p, u), (t_prev, seg_end), x, method="Radau", rtol=1e-10, atol=1e-12)
        x = sol.y[:, -1]; t_prev = seg_end; out.append(x[1])
    err = np.max(np.abs(np.array(out) - T_ref) / T_ref)
    rows.append((g["name"], g["preset"], len(t_grid), T_ref.max(), err))
pd.DataFrame(rows, columns=["trajectoire", "preset", "points", "T max [K]", "écart relatif Radau vs LSODA"])'''),
]

# =================================================================================================
# 02 — Van Heerden
# =================================================================================================
NB02 = [
    ("md", """# 02 — Diagramme de Van Heerden, bifurcations et dimensionnement de l'enveloppe (S1-C03, S1-C04)

On trace la chaleur générée $Q_{gen}(T)$ et la chaleur évacuée $Q_{\\acute{e}vac}(T)$ à l'état quasi-stationnaire en $C_A$ :

$$Q_{gen}(T)=(-\\Delta H_r)\\,k(T)\\,C_A(T)\\,V,\\qquad
Q_{\\acute{e}vac}(T)=F\\rho C_p(T-T_{in}) + UA\\,(T-T_c)$$

Un état stationnaire est une intersection ; il est **stable** si $dQ_{\\acute{e}vac}/dT > dQ_{gen}/dT$ (critère de Van Heerden)."""),
    ("code", SETUP),
    ("code", '''def qgen(T, p):
    D = p.F / p.V
    ca = D * p.CAin / (D + arrhenius(T, p.k0, p.EaR))
    return -p.dHr * arrhenius(T, p.k0, p.EaR) * ca * p.V

def qrem(T, p, Tc=None, UA=None):
    Tc = p.Tc if Tc is None else Tc
    UA = UA_eff(p) if UA is None else UA
    return p.F * p.rho * p.cp * (T - p.Tin) + UA * (T - Tc)

def vh_plot(ax, p, title, T_range):
    T = np.linspace(*T_range, 600)
    ax.plot(T, [qgen(t, p) / 1e3 for t in T], "tab:red", lw=2, label="$Q_{gen}$")
    ax.plot(T, [qrem(t, p) / 1e3 for t in T], "tab:blue", lw=2, label="$Q_{évac}$")
    for ca, Ts in steady_states_level1(p):
        slope_gen = (qgen(Ts + 1e-3, p) - qgen(Ts - 1e-3, p)) / 2e-3
        slope_rem = (qrem(Ts + 1e-3, p) - qrem(Ts - 1e-3, p)) / 2e-3
        stable = slope_rem > slope_gen
        ax.plot(Ts, qgen(Ts, p) / 1e3, "o" if stable else "X", ms=10,
                color="tab:green" if stable else "tab:orange")
        ax.annotate(f"{Ts:.1f} K", (Ts, qgen(Ts, p) / 1e3), textcoords="offset points", xytext=(6, -14))
    ax.set(title=title, xlabel="T [K]", ylabel="Q [kW]"); ax.legend()

fig, axes = plt.subplots(1, 2, figsize=(12, 4.5))
vh_plot(axes[0], seborg().with_(level=1), "Seborg — 3 états (● stable, ✖ instable)", (290, 420))
vh_plot(axes[1], propylene_oxide().with_(level=1), "Oxyde de propylène — 3 états", (290, 380))
fig.tight_layout()'''),
    ("md", """## Effet de $T_c$ et de $UA$ : hystérésis d'allumage / d'extinction

En balayant $T_c$, le nombre d'états stationnaires passe de 1 à 3 puis à 1 : les bifurcations (points limites) fixent la **température critique d'allumage** $T_{c,ign}$ et celle d'**extinction** $T_{c,ext}$."""),
    ("code", '''def n_states(p, Tc):
    return len(steady_states_level1(p.with_(Tc=Tc)))

def bifurcation_curve(p, Tcs):
    pts = []
    for Tc in Tcs:
        for ca, T in steady_states_level1(p.with_(Tc=Tc)):
            pts.append((Tc, T))
    return np.array(pts)

p = seborg().with_(level=1)
Tcs = np.linspace(280, 330, 201)
B = bifurcation_curve(p, Tcs)
counts = np.array([n_states(p, t) for t in Tcs])
# bornes de la zone de multiplicité
multi = Tcs[counts == 3]
print(f"Seborg : 3 états stationnaires pour T_c ∈ [{multi.min():.2f} ; {multi.max():.2f}] K")
print(f"  → extinction possible si T_c > {multi.max():.2f} K (disparition de l'état haut)")
print(f"  → allumage possible si T_c < {multi.min():.2f} K (disparition de l'état bas)")
fig, ax = plt.subplots(figsize=(7, 4.5))
ax.plot(B[:, 0], B[:, 1], ".", ms=2)
ax.axvline(p.Tc, color="k", ls="--", lw=0.8)
ax.set(xlabel="T_c [K]", ylabel="T stationnaire [K]", title="Diagramme de bifurcation (Seborg) — en pointillé : T_c = 300 K")
fig.tight_layout()'''),
    ("code", '''fig, ax = plt.subplots(figsize=(7, 4.5))
for UA, c in [(600, "tab:purple"), (833.33, "tab:blue"), (1100, "tab:green")]:
    pp = p.with_(UAref=UA)
    Tg = np.linspace(290, 420, 400)
    ax.plot(Tg, [qrem(t, pp, UA=UA) / 1e3 for t in Tg], color=c, label=f"$Q_{{évac}}$, UA = {UA:.0f} W/K")
ax.plot(Tg, [qgen(t, p) / 1e3 for t in Tg], "tab:red", lw=2.5, label="$Q_{gen}$")
ax.set(xlabel="T [K]", ylabel="Q [kW]", ylim=(-20, 140), title="Un UA plus faible (encrassement) déplace les intersections")
ax.legend(); fig.tight_layout()'''),
    ("md", """## S1-C04 — Dimensionnement de l'enveloppe (niveau 2)

Cahier des charges : au point nominal du benchmark ($T=350$ K, $T_j=300$ K) la chaleur à évacuer est $Q=UA\\,(T-T_j)=41{,}7$ kW. À l'équilibre de l'enveloppe, avec la vanne à l'ouverture nominale $v_{nom}$ :

$$F_c=\\frac{Q}{\\rho_j C_{p,j}(T_j-T_{c,in})},\\qquad F_{c,max}=\\frac{F_c}{v_{nom}}$$

**Quelle conception retenir ?** Le point de fonctionnement est instable ; l'enveloppe ajoute un retard de l'ordre de $V_j/F_c$ et sa **capacité d'évacuation maximale** $UA\\,(T-T_{c,in})$ borne la perturbation que *n'importe quel* régulateur peut rattraper. Pour chaque conception on calcule (i) la meilleure marge de stabilité linéaire (abscisse spectrale minimale en boucle fermée ; négative = stabilisable), (ii) le rapport capacité maximale / charge nominale et (iii) la **plus grande perturbation initiale rattrapée** en simulation non linéaire avec les meilleurs gains linéaires."""),
    ("code", '''Q_nom = seborg().UAref * (350 - 300)
rows = []
designs = [("Plan (Vj=20 L, Tcin=285 K, v=0.5)", 20.0, 285.0, 0.5),
           ("Vj=10 L, Tcin=292 K, v=0.5", 10.0, 292.0, 0.5),
           ("Vj=5 L, Tcin=285 K, v=0.5", 5.0, 285.0, 0.5),
           ("RETENU : Vj=5 L, Tcin=278 K, v=0.3", 5.0, 278.0, 0.3)]
for name, Vj, Tcin, vnom in designs:
    Fc = Q_nom / (1000 * 4.18 * (300 - Tcin))
    p2 = seborg().with_(level=2, Vj=Vj, Tcin=Tcin, Fcmax=Fc / vnom)
    xs = steady_state_level2(p2, vnom, [0.5, 350.0, 300.0, vnom])
    A, B_ = linearize(p2, xs, vnom)
    best = search_gains(A, B_, tau_f=2.0, kp_range=(-2, 1.5), ki_range=(-5, -0.5), kd_values=(0, 3, 10), n=22)
    dT_max = max_recoverable_perturbation(p2, xs, vnom, best[1:])
    rows.append((name, Fc, Fc / vnom, Vj / Fc, best[0], UA_eff(p2) * (350 - Tcin) / Q_nom, dT_max))
pd.DataFrame(rows, columns=["conception", "F_c nominal [L/s]", "F_c,max [L/s]", "τ enveloppe V_j/F_c [s]",
                            "abscisse spectrale min [1/s]", "capacité max / nominal", "ΔT max rattrapable [K]"]).round(3)'''),
    ("md", """**Conclusion S1-C04.** Les quatre conceptions sont stabilisables par un PID avec une marge linéaire quasi identique (≈ −0,033 s⁻¹) : **le jeu du plan est pilotable**. Ce qui les distingue est l'**autorité** : la conception retenue ($V_j=5$ L, eau glacée à 5 °C, $F_{c,max}=1{,}510$ L/s, vanne nominale 30 %) offre 44 % de capacité d'évacuation au-delà du nominal (contre 30 % pour le plan) et rattrape les plus grosses perturbations (≥ 12 K contre ≈ 7,5 K pour le plan, ≈ 4 K pour $V_j=10$ L / $T_{c,in}=292$ K). Elle garde aussi 70 % de course de vanne en réserve vers l'ouverture. Valeurs dans `presets/seborgBenchmark.ts`.

> Limite physique à retenir : même vanne grande ouverte, $Q_{max}\\approx UA\\,(T-T_{c,in})$. Au-delà d'une certaine perturbation du point instable, aucun régulateur ne peut rattraper le réacteur — d'où l'intérêt du quench."""),
    ("code", '''p2 = seborg().with_(level=2)
print(f"Fc,max retenu = {p2.Fcmax:.4f} L/s ;  Fc nominal = {Q_nom / (1000*4.18*(300-278)):.4f} L/s ; vérification dérivées nulles :")
print(np.round(rhs([0.5, 350.0, 300.0, 0.3], p2, Inputs(valve_cmd=0.3)), 6))
print(f"Capacité d'évacuation max (v=1, Tj→Tcin) ≈ {UA_eff(p2) * (350 - 278) / 1e3:.1f} kW  vs nominal {Q_nom / 1e3:.1f} kW")'''),
]

# =================================================================================================
# 03 — Accord PID
# =================================================================================================
NB03 = [
    ("md", """# 03 — Accord du PID (S2-C02)

Le procédé est **instable en boucle ouverte** (pôle réel positif) : les méthodes classiques (Ziegler-Nichols en boucle ouverte, réponse indicielle) ne s'appliquent pas telles quelles. On compare :

1. **Ziegler-Nichols en boucle fermée** : gain ultime $K_u$ (limite d'oscillation) et période $P_u$ lus sur le modèle linéarisé, règles ZN-PID.
2. **Optimisation de marge** (assimilable à un placement de pôles) : gains minimisant l'abscisse spectrale de la boucle fermée linéarisée, puis vérification non linéaire.
3. **Gains retenus** pour l'application, validés en non linéaire (perturbation, échelons de consigne, anti-windup).

Convention du plan : erreur $e=T-T_{sp}$ (action inverse), sortie $u=u_{bias}+K_pe+K_iI+K_d\\dot T_f$."""),
    ("code", SETUP),
    ("code", '''p = seborg().with_(level=2)
v_nom = 0.3
xs = steady_state_level2(p, v_nom, [0.5, 350.0, 300.0, v_nom])
A, B = linearize(p, xs, v_nom)
print("Point de fonctionnement :", np.round(xs, 4))
print("Valeurs propres du procédé en boucle ouverte (s⁻¹) :", np.round(np.linalg.eigvals(A), 4))'''),
    ("md", """## 1. Ziegler-Nichols en boucle fermée (P seul)

Pour un procédé instable, un régulateur P ne stabilise que dans une **fenêtre** $[K_{min},K_{max}]$ (en deçà de $K_{min}$ le pôle instable n'est pas dompté). $K_{max}$ joue le rôle de $K_u$ ; la pulsation d'oscillation donne $P_u=2\\pi/\\omega_u$."""),
    ("code", '''def p_only(kp):
    n = A.shape[0]
    M = A.copy(); M[:, 1] += B * kp
    return np.linalg.eigvals(M)

kps = np.logspace(-3, 1.5, 2000)
stable = np.array([p_only(k).real.max() < 0 for k in kps])
Kmin, Kmax = kps[stable].min(), kps[stable].max()
ev = p_only(Kmax * 1.02)
osc = ev[np.argmax(ev.real)]
Ku, Pu = Kmax, 2 * np.pi / abs(osc.imag)
print(f"Fenêtre de stabilisation du P seul : K_p ∈ [{Kmin:.3f} ; {Kmax:.3f}]   (K_u ≈ {Ku:.3f}, P_u ≈ {Pu:.1f} s)")
zn = dict(kp=0.6 * Ku, ki=0.6 * Ku / (Pu / 2), kd=0.6 * Ku * Pu / 8)
print("ZN-PID : Kp = %.3f  Ki = %.4f  Kd = %.2f" % (zn["kp"], zn["ki"], zn["kd"]))'''),
    ("md", """## 2. Optimisation de la marge de stabilité (linéaire) puis vérification non linéaire"""),
    ("code", '''best = search_gains(A, B, tau_f=2.0, kp_range=(-2, 1.0), ki_range=(-4, -0.5), kd_values=(0, 1, 3, 10), n=30)
print("Marge maximale (abscisse spectrale) = %.4f s⁻¹  pour Kp = %.3f  Ki = %.4f  Kd = %g" % best)

chosen = dict(kp=0.4, ki=0.01, kd=3.0)
candidates = {"ZN boucle fermée": zn,
              "Optimum linéaire": dict(kp=best[1], ki=best[2], kd=best[3]),
              "RETENU (preset)": chosen}
for name, g in candidates.items():
    m = closed_loop_spectral_abscissa(A, B, g["kp"], g["ki"], g["kd"], 2.0)
    print(f"{name:20s} Kp={g['kp']:.3f} Ki={g['ki']:.4f} Kd={g['kd']:.2f}   abscisse spectrale = {m:+.4f} s⁻¹")'''),
    ("code", '''fig, axes = plt.subplots(1, 3, figsize=(15, 4))
for name, g in candidates.items():
    pid = lambda sp=350.0: Pid(g["kp"], g["ki"], g["kd"], 2.0, v_nom, sp)
    t, X, V = closed_loop(p, [0.5, 353.5, 300.0, v_nom], pid(), t_end=200)
    axes[0].plot(t, X[1], label=name)
    t, X, V = closed_loop(p, list(xs), pid(), t_end=200, events=[(5, {"sp": 354.0})])
    axes[1].plot(t, X[1], label=name)
    axes[2].plot(t, V, label=name)
axes[0].set(title="Rejet d'une perturbation de +3,5 K", xlabel="t [s]", ylabel="T [K]")
axes[1].set(title="Échelon de consigne 350 → 354 K à t = 5 s", xlabel="t [s]", ylabel="T [K]")
axes[2].set(title="Commande de vanne (échelon de consigne)", xlabel="t [s]", ylabel="v_cmd")
axes[0].legend(); fig.tight_layout()'''),
    ("md", """### Métriques comparées (simulation non linéaire)"""),
    ("code", '''rows = []
for name, g in candidates.items():
    pidf = lambda sp=350.0: Pid(g["kp"], g["ki"], g["kd"], 2.0, v_nom, sp)
    t, X, V = closed_loop(p, [0.5, 353.5, 300.0, v_nom], pidf(), t_end=300)
    e = np.abs(X[1] - 350.0)
    settle_pert = float(t[np.where(e > 0.5)[0][-1]]) if (e > 0.5).any() else 0.0
    iae = float(np.trapezoid(e, t))
    t2, X2, V2 = closed_loop(p, list(xs), pidf(), t_end=300, events=[(5, {"sp": 354.0})])
    over, settle_sp = step_metrics(t2, X2[1], 354.0, 5.0)
    dmax = max_recoverable_perturbation(p, xs, v_nom, (g["kp"], g["ki"], g["kd"]))
    rows.append((name, round(X[1].max() - 350, 2), round(settle_pert, 1), round(iae, 1),
                 round(over, 2), round(settle_sp, 1), round(float(V2.max()), 2), round(dmax, 1)))
pd.DataFrame(rows, columns=["gains", "pic ΔT perturb. [K]", "t réponse perturb. [s]", "IAE [K·s]",
                            "dépassement échelon [K]", "t réponse échelon [s]", "vanne max (échelon)",
                            "ΔT max rattrapable [K]"]).set_index("gains")'''),
    ("md", """**Lecture (mesures ci-dessus).** Les trois jeux de gains stabilisent le procédé et rattrapent la perturbation maximale testée (12 K, plafond de la bissection) : le ZN en boucle fermée appliqué à la fenêtre de stabilité du P seul donne ici un résultat convenable, avec la plus petite IAE (≈ 123 K·s). Les gains **retenus** sont les plus *doux* : dépassement d'échelon de consigne le plus faible (0,5 K contre ≈ 1 K) et sollicitation de vanne la plus modérée (pic 0,66 contre 1,00, c'est-à-dire sans saturation), au prix d'une IAE supérieure d'environ 14 %. On les retient pour préserver la marge d'autorité de la vanne et pour que la démonstration de l'anti-windup (§3) reste lisible : une saturation vient d'une vraie perte d'autorité, pas d'un réglage nerveux.

Les valeurs ZN sont à retenir comme point de comparaison ; l'équipe Génie Chimique pourra les substituer dans `SEBORG_PID`."""),
    ("md", """## 3. Anti-windup : avec / sans clamping

On impose une charge thermique excessive ($T_{in}=360$ K au lieu de 340 K) : la vanne sature. Quand la charge disparaît à $t=60$ s, un intégrateur *sans* anti-windup a accumulé une erreur (mesures ci-dessous : sans clamping, la vanne reste saturée ≈ 56 s au total (contre ≈ 3 s) et la température passe ≈ 1,9 K sous la consigne ; avec clamping, aucun sous-dépassement)."""),
    ("code", '''fig, ax = plt.subplots(figsize=(8, 4.2))
results = {}
for aw, c in [(True, "tab:blue"), (False, "tab:red")]:
    pid = Pid(0.4, 0.01, 3.0, 2.0, v_nom, 340.0, anti_windup=aw)
    # T_in = 360 K (charge excessive) jusqu'à t = 60 s, puis retour à 340 K : une seule simulation continue
    t, X, V = closed_loop(p.with_(Tin=360.0), list(xs), pid, t_end=150,
                          events=[(60, {"params": {"Tin": 340.0}})])
    results[aw] = (t, X, V, pid)
    ax.plot(t, X[1], color=c, label=f"anti-windup {'ON' if aw else 'OFF'}")
ax.axvline(60, color="k", lw=0.8, ls=":"); ax.axhline(340, color="gray", lw=0.8)
ax.set(xlabel="t [s]", ylabel="T [K]", title="Consigne 340 K — la charge disparaît à t = 60 s"); ax.legend()
fig.tight_layout()
for aw, (t, X, V, pid) in results.items():
    after = t > 60
    sat = (V > 0.999)
    print(f"anti-windup {'ON ' if aw else 'OFF'} : vanne saturée {sat.sum() * 0.1:5.1f} s ; "
          f"T minimale après t = 60 s : {X[1][after].min():.2f} K ; "
          f"écart max sous la consigne : {340 - X[1][after].min():+.2f} K")'''),
    ("md", """## 4. Valeurs retenues (reprises dans `presets/seborgBenchmark.ts`)

| Gain | Valeur | Unité |
| --- | --- | --- |
| $K_p$ | 0,4 | K⁻¹ |
| $K_i$ | 0,01 | K⁻¹·s⁻¹ |
| $K_d$ | 3 | s/K |
| $\\tau_f$ | 2 | s |
| $u_{bias}$ | 0,3 | — |

Pour l'**oxyde de propylène** (procédé plus lent, autorité plus faible), la recherche linéaire donne un optimum vers $K_p\\approx1{,}9$, $K_i\\approx0{,}1$, $K_d\\approx20$ (`PROPYLENE_OXIDE_PID`) : la perturbation de +1 K n'est rattrapée qu'après ≈ 300 s, vanne saturée plus de 200 s — la limite d'autorité de ce jeu est documentée ici."""),
    ("code", '''po = propylene_oxide()
ss1 = steady_states_level1(po.with_(level=1))[1]
xs_po = steady_state_level2(po, 0.3, [ss1[0], ss1[1], 285.0, 0.3])
A2, B2 = linearize(po, xs_po, 0.3)
print("PO — valeurs propres boucle ouverte (min⁻¹) :", np.round(np.linalg.eigvals(A2) * 60, 3))
t, X, V = closed_loop(po, [xs_po[0], xs_po[1] + 1.0, xs_po[2], 0.3], Pid(1.9, 0.1, 20, 2.0, 0.3, xs_po[1]), t_end=600)
fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
axes[0].plot(t, X[1] - xs_po[1]); axes[0].set(title="PO : +1 K, PID retenu", xlabel="t [s]", ylabel="ΔT [K]")
axes[1].plot(t, V); axes[1].set(title="Vanne (saturée > 200 s)", xlabel="t [s]", ylabel="v_cmd")
fig.tight_layout()'''),
]

# =================================================================================================
# 04 — Scénarios
# =================================================================================================
NB04 = [
    ("md", """# 04 — Scénarios de référence (S5-C01, S5-C03)

Réponses attendues des quatre scénarios du plan (§4.8), calculées avec le modèle Python (niveau 2, PID retenu, soupape à hystérésis). Le moteur TypeScript, testé dans `scenarios.test.ts`, doit donner les mêmes ordres de grandeur.

| # | Scénario | Événement |
| --- | --- | --- |
| 1 | Démarrage à froid | $C_A=0$, $T=300$ K, PID auto, $T_{sp}=350$ K |
| 2 | Panne de pompe | $\\eta_{pompe}\\to0$ à $t=20$ s |
| 3 | Encrassement | $f$ : 1 → 0,4 en 120 s à partir de $t=10$ s |
| 4 | Quench d'urgence | scénario 2 avancé à $T=390$ K, puis quench (diluant 60 L à 280 K, inhibiteur ×0,05 pendant 180 s, alimentation coupée) |"""),
    ("code", SETUP),
    ("code", '''p = seborg().with_(level=2, relief=True)
SS = [0.5, 350.0, 300.0, 0.3]
mk_pid = lambda: Pid(0.4, 0.01, 3.0, 2.0, 0.3, 350.0)

def crossings(t, T, thresholds):
    out = {}
    for name, th in thresholds.items():
        i = np.where(T >= th)[0]
        out[name] = round(float(t[i[0]]), 1) if len(i) else None
    return out

# --- Scénario 1 ---
t1, X1, V1 = closed_loop(p, [0.0, 300.0, 300.0, 0.0], mk_pid(), t_end=700)
# --- Scénario 2 ---
t2, X2, V2 = closed_loop(p, SS, mk_pid(), t_end=400, events=[(20, {"pump_eff": 0.0})], T_abort=450)
# --- Scénario 3 ---
def fouling_events():
    return [(10 + s, {"fouling": 1 - 0.6 * min(s, 120) / 120}) for s in np.arange(0, 121, 1.0)]
t3, X3, V3 = closed_loop(p, SS, mk_pid(), t_end=300, events=fouling_events())
# --- Scénario 4 ---
ta, Xa, _ = closed_loop(p, SS, mk_pid(), t_end=400, events=[(5, {"pump_eff": 0.0})], stop_on_T=390.0)
x_ready = Xa[:, -1]; t_ready = ta[-1]
pid4 = mk_pid()
t4, X4, V4 = closed_loop(p, list(x_ready), pid4, t_end=400, events=[(0, {"pump_eff": 0.0, "quench": True})], T_abort=450)

t4b, X4b, _ = closed_loop(p, list(x_ready), mk_pid(), t_end=400,
                          events=[(0, {"pump_eff": 0.0, "quench": "keep_feed"})], T_abort=450)
thr = {"H (365 K)": 365, "HH (380 K)": 380, "rupture (450 K)": 450}
pd.DataFrame({
    "1 démarrage": {"T finale [K]": round(X1[1][-1], 2), "T max [K]": round(X1[1].max(), 2)},
    "2 panne pompe": {**crossings(t2, X2[1], thr), "T max [K]": round(X2[1].max(), 1)},
    "3 encrassement": {"vanne saturée dès t [s]": round(float(t3[np.argmax(V3 > 0.98)]), 1), "T finale [K]": round(X3[1][-1], 1)},
    "4 quench (+ arrêt alim.)": {"T avant quench [K]": round(x_ready[1], 1), "T min [K]": round(X4[1].min(), 1),
                 "T finale [K]": round(X4[1][-1], 1), "rupture": bool(X4[1].max() >= 450)},
    "4 bis quench SANS arrêt alim.": {"T min [K]": round(X4b[1].min(), 1), "T finale [K]": round(X4b[1][-1], 1),
                 "rupture": bool(X4b[1].max() >= 450), "T max [K]": round(X4b[1].max(), 1)},
})'''),
    ("code", '''fig, axes = plt.subplots(2, 2, figsize=(12, 7))
axes[0, 0].plot(t1, X1[1]); axes[0, 0].axhline(350, color="gray", ls="--", lw=0.8)
axes[0, 0].set(title="1 — Démarrage à froid", ylabel="T [K]")
axes[0, 1].plot(t2, X2[1], label="T"); axes[0, 1].axhline(365, color="orange", ls=":"); axes[0, 1].axhline(380, color="red", ls=":")
axes[0, 1].axvline(20, color="k", lw=0.8); axes[0, 1].set(title="2 — Panne de pompe (t = 20 s) : H, HH", ylabel="T [K]")
axes[1, 0].plot(t3, X3[1], label="T"); ax2 = axes[1, 0].twinx(); ax2.plot(t3, V3, color="tab:green", alpha=.6); ax2.set_ylabel("vanne")
axes[1, 0].set(title="3 — Encrassement 1 → 0,4", ylabel="T [K]", xlabel="t [s]")
axes[1, 1].plot(t4, X4[1], label="avec quench"); axes[1, 1].plot(t4, X4[0] * 100 + 300, color="tab:purple", alpha=.6, label="C_A (échelle ×100+300)")
axes[1, 1].set(title="4 — Quench à 390 K", xlabel="t [s]", ylabel="T [K]"); axes[1, 1].legend()
fig.tight_layout()'''),
    ("md", """## Recette (S5-C03) — réalisme et enseignements

* **Scénario 1.** Montée régulière sans dépassement notable ni alarme : le démarrage à froid est maîtrisé par le PID.
* **Scénario 2.** L'alarme **H** (365 K) apparaît ≈ 37 s après la panne, **HH** (380 K) ≈ 12 s plus tard, la soupape s'ouvre peu après (P ≥ 3 bar, T ≈ 393 K). La soupape, **volontairement sous-dimensionnée** (Ø ≈ 2,8 mm), ne suffit pas : sans intervention la température monte lentement jusqu'à la rupture. La fenêtre d'intervention entre HH et la rupture est d'environ 160 s simulées, soit ≈ 16 s à ×10.
* **Scénario 3.** La vanne sature dès $t\\approx61$ s (encrassement ≈ 0,7) ; la température dérive ensuite vers un état chaud (≈ 414 K à $t=300$ s, encore en hausse lente) : perte de contrôle progressive, sans pic brutal. Une action opérateur (réduire $F$ ou $C_{A,in}$) la prévient.
* **Scénario 4.** Le quench dilue $A$, refroidit le milieu et coupe l'alimentation : la réaction s'éteint. **Le quench sans coupure de l'alimentation ne suffit pas** (ligne « 4 bis » du tableau) : la vanne d'alimentation continue d'apporter du réactif à 350 K alors que l'enveloppe est hors service.

## Limites du modèle (à signaler aux utilisateurs)

* Pression = inerte + vapeur saturante de **l'eau** : le milieu réel contient du réactif et des produits.
* Chaleur latente constante (2,257 MJ/kg) ; débit de soupape en écoulement compressible simplifié ; pas de perte de masse liquide à la soupape.
* Volume constant (surverse), réaction d'ordre 1 irréversible, paroi de cuve en équilibre thermique instantané avec le milieu."""),
]


def main() -> None:
    books = {
        "01_model_validation.ipynb": NB01,
        "02_van_heerden.ipynb": NB02,
        "03_pid_tuning.ipynb": NB03,
        "04_scenarios.ipynb": NB04,
    }
    for name, cells in books.items():
        path = HERE / name
        nbf.write(nb(cells), path)
        print("écrit", name)
    if "--no-exec" in sys.argv:
        return
    for name in books:
        print("exécution", name, flush=True)
        subprocess.run(
            [sys.executable, "-m", "jupyter", "nbconvert", "--to", "notebook", "--execute", "--inplace",
             "--ExecutePreprocessor.timeout=1200", str(HERE / name)],
            check=True, cwd=HERE,
        )


if __name__ == "__main__":
    main()
