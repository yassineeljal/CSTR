"""Modèle de référence du CSTR (Python/SciPy) — PLAN §4.

Miroir exact des équations du moteur TypeScript (`src/simulation/equations.ts`).
Unités moteur : s, K, mol/L, L, g/L, J, W, Pa.
Sert de « vérité terrain » : les notebooks l'utilisent et `export_golden.py` en tire
les trajectoires comparées au moteur TS (erreur relative < 0,5 %).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field, asdict, replace

import numpy as np
from scipy.integrate import solve_ivp

R_GAS = 8.314462618
MMHG_TO_PA = 101325 / 760
M_WATER = 0.01801528
ANTOINE = {"low": (8.07131, 1730.63, 233.426), "high": (8.14019, 1810.94, 244.485)}


@dataclass(frozen=True)
class Params:
    """Paramètres (unités moteur). Valeurs par défaut = benchmark de Seborg (PLAN §4.6)."""

    level: int = 2
    V: float = 100.0  # L
    F: float = 100 / 60  # L/s
    CAin: float = 1.0  # mol/L
    Tin: float = 350.0  # K
    k0: float = 7.2e10 / 60  # 1/s
    EaR: float = 8750.0  # K
    dHr: float = -5.0e4  # J/mol
    rho: float = 1000.0  # g/L
    cp: float = 0.239  # J/(g K)
    UAref: float = 5.0e4 / 60  # W/K
    UAmin: float = 5.0e4 / 60 * 0.1  # W/K
    uexp: float = 2 / 3
    rpm: float = 120.0
    rpmRef: float = 120.0
    Tc: float = 300.0  # K (niveau 1)
    Vj: float = 5.0  # L  (S1-C04 : voir notebook 02)
    rhoj: float = 1000.0
    cpj: float = 4.18
    Tcin: float = 278.0  # K (5 °C, eau glacée)
    Fcmax: float = 1.5103  # L/s (S1-C04, voir notebook 02)
    tauV: float = 2.0
    rMax: float = 0.25
    # soupape
    Pinert: float = 1.013e5
    Patm: float = 101325.0
    Pset: float = 3.0e5
    Cd: float = 0.65
    As: float = 1.5e-5
    Lv: float = 2.257e6
    relief: bool = False  # désactivée pour les trajectoires de référence

    def with_(self, **kw) -> "Params":
        return replace(self, **kw)

    def asdict(self) -> dict:
        return asdict(self)


@dataclass
class Inputs:
    valve_cmd: float = 0.5
    pump_eff: float = 1.0
    fouling: float = 1.0
    inhibitor: float = 1.0
    relief_open: bool = False


def arrhenius(T: float, k0: float, EaR: float) -> float:
    return k0 * math.exp(-EaR / T) if T > 0 else 0.0


def UA_eff(p: Params, fouling: float = 1.0) -> float:
    forced = p.UAref * (max(p.rpm, 0.0) / p.rpmRef) ** p.uexp
    return max(forced, p.UAmin) * fouling


def p_sat_water(T: float) -> float:
    Tc = min(T, 647.096) - 273.15
    A, B, C = ANTOINE["low"] if Tc <= 100 else ANTOINE["high"]
    return 10 ** (A - B / (C + Tc)) * MMHG_TO_PA


def relief_heat(T: float, p: Params) -> float:
    psat = p_sat_water(T)
    dP = p.Pinert + psat - p.Patm
    if dP <= 0 or T <= 0:
        return 0.0
    rho_v = psat * M_WATER / (R_GAS * T)
    return p.Cd * p.As * math.sqrt(2 * rho_v * dP) * p.Lv


def rhs(x, p: Params, u: Inputs):
    """dx/dt, x = [CA, T, Tj, v] (PLAN §4.3)."""
    CA, T, Tj, v = x
    if p.level == 1:
        Tj = p.Tc
    D = p.F / p.V
    k = arrhenius(T, p.k0 * u.inhibitor, p.EaR)
    rcp = p.rho * p.cp
    ua = UA_eff(p, u.fouling)
    q_relief = relief_heat(T, p) if (p.relief and u.relief_open) else 0.0
    dCA = D * (p.CAin - CA) - k * CA
    dT = D * (p.Tin - T) + (-p.dHr * k * CA) / rcp - ua / (p.V * rcp) * (T - Tj) - q_relief / (p.V * rcp)
    if p.level == 1:
        return [dCA, dT, 0.0, 0.0]
    Fc = v * p.Fcmax * u.pump_eff
    dTj = Fc / p.Vj * (p.Tcin - Tj) + ua / (p.Vj * p.rhoj * p.cpj) * (T - Tj)
    dv = min(max((u.valve_cmd - v) / p.tauV, -p.rMax), p.rMax)
    return [dCA, dT, dTj, dv]


def simulate(p: Params, x0, t_end, u: Inputs | None = None, events=None, n=None, rtol=1e-10, atol=1e-12):
    """Intégration de référence (LSODA/Radau) avec des changements d'entrées scriptés.

    `events` : liste triée de (t, dict d'attributs d'Inputs à modifier).
    Retourne (t, X) avec X de forme (4, n).
    """
    u = u or Inputs()
    events = sorted(events or [], key=lambda e: e[0])
    bounds = [0.0] + [e[0] for e in events if 0 < e[0] < t_end] + [t_end]
    ts, xs = [], []
    x = np.array(x0, dtype=float)
    ei = 0
    for a, b in zip(bounds[:-1], bounds[1:]):
        while ei < len(events) and events[ei][0] <= a + 1e-12:
            for k_, v_ in events[ei][1].items():
                setattr(u, k_, v_)
            ei += 1
        te = np.linspace(a, b, max(2, int((b - a) * 10) + 1))
        sol = solve_ivp(lambda t, y: rhs(y, p, u), (a, b), x, method="LSODA", t_eval=te, rtol=rtol, atol=atol)
        ts.append(sol.t if not ts else sol.t[1:])
        xs.append(sol.y if not xs else sol.y[:, 1:])
        x = sol.y[:, -1]
    return np.concatenate(ts), np.concatenate(xs, axis=1)


def steady_states_level1(p: Params):
    """États stationnaires du niveau 1 (balayage en T + racines de Q_gen − Q_removal)."""
    from scipy.optimize import brentq

    def ca_ss(T):
        D = p.F / p.V
        return D * p.CAin / (D + arrhenius(T, p.k0, p.EaR))

    def g(T):
        D = p.F / p.V
        rcp = p.rho * p.cp
        ua = UA_eff(p)
        return (-p.dHr * arrhenius(T, p.k0, p.EaR) * ca_ss(T)) / rcp + D * (p.Tin - T) - ua / (p.V * rcp) * (T - p.Tc)

    Ts = np.linspace(280, 560, 5601)
    gs = np.array([g(T) for T in Ts])
    roots = [brentq(g, Ts[i], Ts[i + 1], xtol=1e-12) for i in range(len(Ts) - 1) if gs[i] * gs[i + 1] < 0]
    return [(ca_ss(T), T) for T in roots]


def jacobian_level1(p: Params, x0, eps=1e-6):
    u = Inputs()
    x0 = np.array(x0, float)
    J = np.zeros((2, 2))
    for j in range(2):
        d = np.zeros(4)
        d[j] = eps
        fp = np.array(rhs(x0 + d, p, u))[:2]
        fm = np.array(rhs(x0 - d, p, u))[:2]
        J[:, j] = (fp - fm) / (2 * eps)
    return J
