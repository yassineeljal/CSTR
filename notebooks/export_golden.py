"""Génère les trajectoires de référence `tests/golden/*.json` (S1-C05).

Chaque fichier contient les paramètres (noms TypeScript de `ReactorParams`), l'état initial,
la commande de vanne, les événements scriptés et la trajectoire SciPy échantillonnée à 1 s.
Les tests Vitest (`src/simulation/__tests__/golden.test.ts`) rejouent la même simulation avec
le moteur RK4 TypeScript et comparent.

Usage :  python export_golden.py
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from cstr_model import Inputs, Params, simulate

OUT = Path(__file__).resolve().parent.parent / "tests" / "golden"

# Correspondance Params (Python) → ReactorParams (TypeScript). Source unique des noms.
TS_NAMES = {
    "V": "volumeL", "F": "feedFlowLps", "CAin": "caInMolL", "Tin": "tInK",
    "k0": "k0PerS", "EaR": "eaOverRK", "dHr": "deltaHrJMol", "rho": "rhoGL", "cp": "cpJGK",
    "UAref": "uaRefWK", "UAmin": "uaMinWK", "uexp": "uExponent", "rpm": "rpm", "rpmRef": "rpmRef",
    "Tc": "tcK", "Vj": "jacketVolumeL", "rhoj": "jacketRhoGL", "cpj": "jacketCpJGK",
    "Tcin": "tcInK", "Fcmax": "fcMaxLps", "tauV": "valveTauS", "rMax": "valveRateMaxPerS",
    "Pinert": "inertPressurePa", "Patm": "atmPressurePa", "Pset": "reliefSetPressurePa",
    "Cd": "reliefCd", "As": "reliefAreaM2", "Lv": "latentHeatJKg",
}


def ts_params(p: Params) -> dict:
    d = {TS_NAMES[k]: v for k, v in p.asdict().items() if k in TS_NAMES}
    d["modelLevel"] = p.level
    d["reliefEnabled"] = p.relief
    return d


def case(name, description, p, x0, valve, t_end, events=None):
    events = events or []
    u = Inputs(valve_cmd=valve)
    # Les événements Python utilisent les noms Inputs ; on les traduit pour TS.
    t, X = simulate(p, x0, t_end, u=u, events=[(te, dict(ev)) for te, ev in events])
    grid = np.arange(0, t_end + 1e-9, 1.0)
    idx = [int(np.argmin(np.abs(t - g))) for g in grid]
    ts_events = []
    for te, ev in events:
        ts_ev = {}
        for k, v in ev.items():
            ts_ev[{"pump_eff": "pumpEfficiency", "fouling": "fouling", "inhibitor": "inhibitorFactor"}[k]] = v
        ts_events.append({"t": te, "set": ts_ev})
    data = {
        "name": name,
        "description": description,
        "params": ts_params(p),
        "initialState": dict(zip(["CA", "T", "Tj", "v"], map(float, x0))),
        "valveCmd": valve,
        "events": ts_events,
        "t": [float(t[i]) for i in idx],
        "CA": [float(X[0][i]) for i in idx],
        "T": [float(X[1][i]) for i in idx],
        "Tj": [float(X[2][i]) for i in idx],
        "v": [float(X[3][i]) for i in idx],
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(data, indent=1))
    print(f"{name:32s} T[0]={X[1][0]:.2f}  T[end]={X[1][-1]:.2f}  Tmax={X[1].max():.2f}")


def main():
    p1 = Params(level=1)
    p2 = Params(level=2)
    ss1 = [0.5, 350.0, 300.0, 0.0]
    ss2 = [0.5, 350.0, 300.0, 0.3]

    case("l1_open_loop_plus_half_kelvin",
         "Niveau 1, +0,5 K sur le point instable : divergence exponentielle (λ ≈ +2,83 min⁻¹).",
         p1, [0.5, 350.5, 300.0, 0.0], 0.0, 60)
    case("l1_open_loop_minus_half_kelvin",
         "Niveau 1, −0,5 K : extinction vers l'état stationnaire bas (324,5 K).",
         p1, [0.5, 349.5, 300.0, 0.0], 0.0, 300)
    case("l1_cold_start",
         "Niveau 1, démarrage à froid en boucle ouverte (oscillations amorties vers 324,5 K).",
         p1, [0.0, 300.0, 300.0, 0.0], 0.0, 300)
    case("l2_pump_failure",
         "Niveau 2, vanne fixe à 30 %, panne de pompe à t = 10 s : l'enveloppe se réchauffe, T diverge.",
         p2, ss2, 0.3, 30, events=[(10.0, {"pump_eff": 0.0})])
    case("l2_fouling_step",
         "Niveau 2, vanne fixe, encrassement brusque f = 0,6 à t = 5 s.",
         p2, ss2, 0.3, 45, events=[(5.0, {"fouling": 0.6})])
    case("l2_low_agitation",
         "Niveau 2, agitation réduite de moitié (N = 60 tr/min) : U·A ∝ N^(2/3) baisse.",
         p2.with_(rpm=60.0), ss2, 0.3, 45)
    case("l2_feed_perturbation",
         "Niveau 2, vanne fixe à 60 %, débit d'alimentation +20 % (F = 2,0 L/s).",
         p2.with_(F=2.0), ss2, 0.6, 120)


if __name__ == "__main__":
    main()
