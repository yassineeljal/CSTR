# 🧪 CSTR Digital Twin

[![CI](https://github.com/yassineeljal/CSTR/actions/workflows/ci.yml/badge.svg)](https://github.com/yassineeljal/CSTR/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**[Version française](README.fr.md)**

A real-time 3D **digital twin of an exothermic continuous stirred-tank reactor (CSTR)**, simulated at 60 Hz in the browser, rendered with React Three Fiber and GLSL shaders, and operated from a SCADA-style control room. Watch a thermal runaway unfold (Arrhenius feedback), fight it with a PID controller, a relief valve and an emergency quench, then switch to inspection mode to see the equations live.

> A joint **chemical engineering** (Polytechnique Montréal) × **software / 3D engineering** (ÉTS) project.

![Control room](docs/screenshots/01-control-room.png)

| Thermal runaway                             | Inspection mode                                   | Theory sheet                              |
| ------------------------------------------- | ------------------------------------------------- | ----------------------------------------- |
| ![Runaway](docs/screenshots/02-runaway.png) | ![Inspection](docs/screenshots/03-inspection.png) | ![Theory](docs/screenshots/04-theory.png) |

## Features

- **Rigorous process model**: material and energy balances, jacket with control valve, steam pressure (Antoine), relief valve with hysteresis. Fixed-step RK4 (0.01 s) with adaptive sub-stepping, sampled discrete PID (inverse action, derivative on measurement, clamping anti-windup, bumpless transfer). Two parameter sets: the Seborg benchmark and propylene oxide hydrolysis (Fogler kinetics).
- **Four scenarios**: cold start, cooling pump failure, fouling, emergency quench. A full rescue run is covered by an end-to-end test.
- **Control room**: process controls, PID (Auto/Manual), two-step quench (arm, then fire), 10 Hz readouts colored by alarm level, four live charts, ISA-18.2-style alarms (acknowledgement, unacknowledged return-to-normal), event log, presets (localStorage + validated JSON import/export), keyboard shortcuts.
- **3D**: vessel, jacket, baffles and agitator are procedural (animated cutaway done in a shader). Detailed parts (motor, flanges, nozzles, piping, relief valve, legs) are modeled in **Blender** via a versioned `bpy` script and exported as a 52 KB Draco `.glb`. Thermal fluid with vortex and boiling waves, GPU-driven bubbles and steam, bloom, vibration near rupture.
- **Inspection mode**: anchored 3D labels (KaTeX formula + live value), seven theory sheets, live Van Heerden diagram.
- **Robust**: on-demand rendering (zero cost at rest), adaptive quality, auto-pause on hidden tab, 2D fallback without WebGL, error boundary.

## Quick start

```bash
pnpm install
pnpm dev                 # http://localhost:3000
pnpm test                # unit tests (Vitest)
pnpm test:e2e            # all end-to-end tests (Playwright, production build)
pnpm test:e2e:3d         # 3D scene, captures, performance (real WebGL)
PERF_GPU=1 pnpm test:e2e:3d   # same, on the machine's GPU
```

Useful URLs:

| URL                                            | What it does                              |
| ---------------------------------------------- | ----------------------------------------- |
| `/?scenario=pump-failure&speed=10&autostart=1` | Starts a scenario immediately             |
| `/?kiosk=1`                                    | Scene only, no UI (presentations, embeds) |
| `/debug`                                       | Raw engine values and controls            |
| `/about`                                       | Team, architecture, credits               |

Keyboard: `Space` run/pause · `Q` arm quench · `R` reset · `C` cutaway · `I` inspection · `1`–`4` load scenario.

### Notebooks (chemical engineering)

```bash
cd notebooks
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
jupyter lab                      # 01 validation · 02 Van Heerden · 03 PID tuning · 04 scenarios
python export_golden.py          # regenerate tests/golden/ (SciPy reference trajectories)
python check_golden.py           # verify they are up to date (used in CI)
```

### 3D assets (Blender 5.x)

```bash
pnpm geometry:export             # tools/blender/geometry.json from src/simulation/geometry.ts
blender -b --factory-startup --python tools/blender/build_reactor_assets.py -- \
        --out public/models/reactor-details.glb
```

## Architecture

```
┌──────────────── Main thread ─────────────────────┐      ┌────────── Web Worker ──────────┐
│ React HUD ──commands──► SimulationClient ────────┼─────►│ SimulationHost                  │
│   ▲  slow state (Zustand)     │ onmessage        │      │  accumulator ─► RK4 (0.01 s)    │
│   └── alarms / mode ◄─────────┤                  │      │              ─► PID (0.1 s)     │
│                  simRef (mutable Float64Array)   │◄─────┤              ─► scenario, alarms│
│   useFrame (R3F) ◄──┘     └─► uPlot charts       │      │  transferable snapshot ≈ 60 Hz  │
└──────────────────────────────────────────────────┘      └─────────────────────────────────┘
```

- `src/simulation/` is a **pure** physics core (no React or Three imports), testable under Node.
- No 60 Hz data lives in React state: it is read directly in `useFrame` and written to DOM refs at 10 Hz.
- `SimulationTransport` lets the local Worker be swapped for a WebSocket server without touching the UI.

Architecture decisions: [`docs/decisions/`](docs/decisions/) · Model and justified deviations from the original plan: [`docs/model.md`](docs/model.md) · Original plan: [`docs/PLAN.md`](docs/PLAN.md).

## Validation

| Level                                                               | Result                                                                                                                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| TS engine vs SciPy (10 trajectories, 2 parameter sets, up to 456 K) | max relative error **< 3·10⁻⁸** (requirement: 0.5 %)                                                                         |
| Unit tests (Vitest)                                                 | **273**, ≈ 96 % line coverage                                                                                                |
| End-to-end tests (Playwright, production build)                     | **26**: 15 "ui" (full HUD in 2D mode, no WebGL), 10 "3d" (scene, inspection, perf, quality), 1 light 3D smoke test run in CI |
| Theory sheet formulas                                               | compiled in strict mode by KaTeX in the tests                                                                                |
| Lighthouse (desktop, GPU)                                           | **100 / 100 / 100 / 100**                                                                                                    |

Measured performance, see [`docs/perf.md`](docs/perf.md): engine 0.031 ms per tick (budget 2 ms), 90 draw calls, ≈ 58 FPS, GPU memory stable over a 10-minute soak.

## Known limitations

- Pressure model is pure water + inert; constant volume; perfect mixing; the relief valve is **deliberately undersized** so scenarios have stakes.
- Values tagged `TODO(chem)` in `src/simulation/presets/` have **not** been validated by chemical engineers. The propylene oxide operating conditions (C_A,in = 4 mol/L…) are pedagogical assumptions chosen to obtain three steady states.
- Several parameters deviate from the initial plan (wall heat capacity, resized jacket, alarm thresholds, quench that also cuts the feed): quantified justifications in `docs/model.md` §2.
- Not implemented: FR/EN language switch, Supabase persistence (both optional), real-time server architecture (backlog).

## Deploying (Vercel)

The app is fully static on the server side (`next build`); the engine runs in the browser.

1. Import the repository in Vercel (Next.js preset, default `pnpm build`).
2. Set `NEXT_PUBLIC_SITE_URL` (public URL, used for share previews and the sitemap).
3. Every pull request gets a preview URL; `main` deploys to production.
4. Custom domain: _Project → Settings → Domains_, then add the DNS record shown (HTTPS is automatic).
5. On the preview, check that the worker is served (`/debug` shows "worker : OK").

## Credits

- S. Seborg, T. Edgar, D. Mellichamp, F. Doyle, _Process Dynamics and Control_ (CSTR benchmark).
- H. S. Fogler, _Elements of Chemical Reaction Engineering_ (propylene oxide kinetics).
- E. Paul, V. Atiemo-Obeng, S. Kresta, _Handbook of Industrial Mixing_ (stirred-tank proportions).
- Three.js, React Three Fiber, drei, postprocessing, uPlot, KaTeX, Zustand, Next.js, Vitest, Playwright.

License: [MIT](LICENSE).
