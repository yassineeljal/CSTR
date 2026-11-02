"""Boucle fermée PID discret (miroir de src/simulation/pid.ts) pour l'accord (S2-C02)."""
from __future__ import annotations

import numpy as np
from scipy.integrate import solve_ivp

from cstr_model import Params, Inputs, rhs


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


def closed_loop(p: Params, x0, pid: Pid, t_end=300.0, events=None, ts=0.1, T_abort=600.0):
    """Simule la boucle fermée. `events` : [(t, {attr: valeur | 'sp': consigne})]."""
    u = Inputs(valve_cmd=x0[3])
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
                else:
                    setattr(u, k, v)
            ei += 1
        u.valve_cmd = pid.update(x[1])
        sol = solve_ivp(lambda tt, y: rhs(y, p, u), (t, t + ts), x, method="LSODA", rtol=1e-7, atol=1e-9)
        x = sol.y[:, -1]
        T.append(t + ts)
        X.append(x.copy())
        V.append(u.valve_cmd)
        if x[1] > T_abort:
            break
    return np.array(T), np.array(X).T, np.array(V)
