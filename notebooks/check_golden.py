"""Vérifie que les trajectoires golden commitées correspondent à la source Python (CI).

Régénère dans un dossier temporaire puis compare numériquement (tolérance relative 1e-7) : un
`git diff` strict échouerait à tort entre plateformes (arrondis de LSODA à ~1e-12).
Usage : python check_golden.py
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
COMMITTED = HERE.parent / "tests" / "golden"
RTOL = 1e-7
ATOL = 1e-9


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([sys.executable, str(HERE / "export_golden.py"), "--out", tmp], check=True, cwd=HERE, stdout=subprocess.DEVNULL)
        fresh = {p.name: json.loads(p.read_text()) for p in Path(tmp).glob("*.json")}
    committed = {p.name: json.loads(p.read_text()) for p in COMMITTED.glob("*.json")}
    problems = []
    if set(fresh) != set(committed):
        problems.append(f"fichiers différents : seulement générés {sorted(set(fresh) - set(committed))}, seulement commités {sorted(set(committed) - set(fresh))}")
    for name in sorted(set(fresh) & set(committed)):
        a, b = fresh[name], committed[name]
        for key in ("params", "initialState", "events", "preset", "valveCmd", "name"):
            if a[key] != b[key]:
                problems.append(f"{name}: champ « {key} » différent")
        for key in ("t", "CA", "T", "Tj", "v"):
            if not np.allclose(a[key], b[key], rtol=RTOL, atol=ATOL):
                worst = float(np.max(np.abs(np.array(a[key]) - np.array(b[key]))))
                problems.append(f"{name}: canal « {key} » diverge (écart max {worst:.3e})")
    if problems:
        print("Fichiers golden périmés — relancer `python export_golden.py` et commiter :")
        print("\n".join(" - " + p for p in problems))
        return 1
    print(f"{len(fresh)} trajectoires golden à jour (rtol {RTOL}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
