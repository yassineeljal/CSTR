"""Boucle fermée PID discret (miroir de src/simulation/pid.ts) pour l'accord (S2-C02)."""
from __future__ import annotations

import numpy as np
from scipy.integrate import solve_ivp

from cstr_model import Params, Inputs, p_sat_water, rhs


class Pid:
    """PID positionnel à action inverse, dérivée sur la mesure filtrée, anti-windup par clamping."""

    def __init__(self, kp, ki, kd, tau_f, bias, sp, dt=0.1, anti_windup=True):
        self.kp, self.ki, self.kd, self.tau, self.bias, self.sp, self.dt = kp, ki, kd, tau_f, bias, sp, dt
        self.anti_windup = anti_windup
        self.I = 0.0
        self.D = 0.0
        self.prev = None

    def engage(self, u, T):
        self.prev = T
        self.D = 0.0
        e = T - self.sp
        self.I = (u - self.bias - self.kp * e) / self.ki if self.ki > 0 else 0.0

    def update(self, T):
        e = T - self.sp
        if self.prev is None:
            self.prev = T
        a = self.tau / (self.tau + self.dt)
        self.D = a * self.D + (1 - a) * (T - self.prev) / self.dt
        self.prev = T
        cand = self.I + e * self.dt
        u = self.bias + self.kp * e + self.ki * cand + self.kd * self.D
        saturating = (u > 1 and e > 0) or (u < 0 and e < 0)
        if not (self.anti_windup and saturating):
            self.I = cand
        return min(max(self.bias + self.kp * e + self.ki * self.I + self.kd * self.D, 0.0), 1.0)


QUENCH = {"V": 60.0, "T": 280.0, "inhibitor": 0.05, "inhibitor_s": 180.0}  # miroir de SEBORG_QUENCH


def closed_loop(p: Params, x0, pid: Pid, t_end=300.0, events=None, ts=0.1, T_abort=600.0, stop_on_T=None):
    """Simule la boucle fermée (PID échantillonné toutes les `ts` s, soupape à hystérésis).

    `events` : [(t, {attr: valeur | 'sp': consigne | 'quench': True})]. Le quench est appliqué
    instantanément (le moteur TypeScript l'étale sur 2 s) : écart négligeable à l'échelle des scénarios.
    `stop_on_T` : arrête la simulation quand T dépasse ce seuil (pré-roulement du scénario 4).
    """
    u = Inputs(valve_cmd=x0[3])
    inhibitor_until = 0.0
    pid.engage(x0[3], x0[1])
    x = np.array(x0, float)
    T, X, V = [0.0], [x.copy()], [u.valve_cmd]
    events = sorted(events or [], key=lambda e: e[0])
    ei = 0
    for i in range(int(round(t_end / ts))):
        t = i * ts
        while ei < len(events) and events[ei][0] <= t + 1e-9:
            for k, v in events[ei][1].items():
                if k == "sp":
                    pid.sp = v
                elif k == "params":  # modification d'un paramètre du procédé en cours de route
                    p = p.with_(**v)
                elif k == "quench":
                    q = QUENCH
                    x[0] *= p.V / (p.V + q["V"])
                    x[1] = (p.V * x[1] + q["V"] * q["T"]) / (p.V + q["V"])
                    if v != "keep_feed":  # arrêt d'urgence : vanne d'alimentation fermée
                        u.feed_factor = 0.0
                    u.inhibitor = q["inhibitor"]
                    inhibitor_until = t + q["inhibitor_s"]
                else:
                    setattr(u, k, v)
            ei += 1
        if inhibitor_until and t >= inhibitor_until:
            u.inhibitor, inhibitor_until = 1.0, 0.0
        if p.relief:
            P = p.Pinert + p_sat_water(x[1])
            u.relief_open = (P >= 0.9 * p.Pset) if u.relief_open else (P > p.Pset)
        u.valve_cmd = pid.update(x[1])
        sol = solve_ivp(lambda tt, y: rhs(y, p, u), (t, t + ts), x, method="LSODA", rtol=1e-7, atol=1e-9)
        x = sol.y[:, -1]
        T.append(t + ts)
        X.append(x.copy())
        V.append(u.valve_cmd)
        if x[1] > T_abort or (stop_on_T is not None and x[1] >= stop_on_T):
            break
    return np.array(T), np.array(X).T, np.array(V)


# ---------------------------------------------------------------------------------------------
# Analyse linéaire pour l'accord (S2-C02)
# ---------------------------------------------------------------------------------------------
def steady_state_level2(p: Params, v_nom: float, guess):
    """État stationnaire exact du niveau 2 pour une ouverture de vanne fixe."""
    from scipy.optimize import fsolve

    u = Inputs(valve_cmd=v_nom)
    return fsolve(lambda x: rhs(x, p, u), guess, xtol=1e-12)


def linearize(p: Params, x_ss, v_nom: float, eps: float = 1e-6):
    """Linéarisation (A, B) autour de l'état stationnaire, entrée = v_cmd."""
    u = Inputs(valve_cmd=v_nom)
    A = np.zeros((4, 4))
    for j in range(4):
        d = np.zeros(4)
        d[j] = eps
        A[:, j] = (np.array(rhs(x_ss + d, p, u)) - np.array(rhs(x_ss - d, p, u))) / (2 * eps)
    B = (np.array(rhs(x_ss, p, Inputs(valve_cmd=v_nom + eps))) - np.array(rhs(x_ss, p, Inputs(valve_cmd=v_nom - eps)))) / (2 * eps)
    return A, B


def closed_loop_spectral_abscissa(A, B, kp, ki, kd, tau_f):
    """Plus grande partie réelle des valeurs propres de la boucle PID (dérivée filtrée du 1er ordre)."""
    n = 6
    M = np.zeros((n, n))
    Kx = np.zeros(n)
    Kx[1] = kp + kd / tau_f
    Kx[4] = ki
    Kx[5] = -kd / tau_f
    M[:4, :4] = A
    M[:4, :] += np.outer(B, Kx)
    M[4, 1] = 1.0
    M[5, 1] = 1.0 / tau_f
    M[5, 5] = -1.0 / tau_f
    return np.linalg.eigvals(M).real.max()


def search_gains(A, B, tau_f=2.0, kp_range=(-2, 1.5), ki_range=(-5, -0.5), kd_values=(0, 1, 3, 10), n=30):
    """Recherche en grille des gains minimisant l'abscisse spectrale (marge de stabilité maximale)."""
    best = (1.0, 0.0, 0.0, 0.0)
    for kp in np.logspace(*kp_range, n):
        for ki in np.logspace(*ki_range, n):
            for kd in kd_values:
                m = closed_loop_spectral_abscissa(A, B, kp, ki, kd, tau_f)
                if m < best[0]:
                    best = (m, kp, ki, kd)
    return best


def max_recoverable_perturbation(p: Params, x_ss, v_nom: float, gains, tau_f=2.0, hi=12.0, tol=0.25, t_end=300.0):
    """Plus grande perturbation initiale ΔT [K] que le PID rattrape (bissection non linéaire).

    « Rattrapé » = T revient à ±0,5 K de la consigne en `t_end` secondes sans dépasser +60 K.
    Mesure l'AUTORITÉ de l'actionneur : au-delà, la vanne saturée ne suffit plus.
    """
    kp, ki, kd = gains

    def ok(dT):
        pid = Pid(kp, ki, kd, tau_f, v_nom, x_ss[1])
        _, X, _ = closed_loop(p, [x_ss[0], x_ss[1] + dT, x_ss[2], v_nom], pid, t_end=t_end, T_abort=x_ss[1] + 60)
        return X[1].max() < x_ss[1] + 60 and abs(X[1][-1] - x_ss[1]) < 0.5

    lo = 0.0
    if not ok(tol):
        return 0.0
    if ok(hi):
        return hi
    while hi - lo > tol:
        mid = 0.5 * (lo + hi)
        lo, hi = (mid, hi) if ok(mid) else (lo, mid)
    return lo


def step_metrics(t, T, sp, t_step):
    """Dépassement [K] et temps de réponse à ±0,5 K [s] après un échelon de consigne à t_step."""
    after = t >= t_step
    ts, Ts = t[after], T[after]
    final = sp
    overshoot = max(0.0, (Ts.max() - final) * np.sign(final - T[0]) if final != T[0] else 0.0)
    out = np.where(np.abs(Ts - final) > 0.5)[0]
    settle = float(ts[out[-1]] - t_step) if len(out) else 0.0
    return overshoot, settle
