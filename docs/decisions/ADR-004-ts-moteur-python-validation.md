# ADR-004 — TypeScript pour le moteur, Python pour la validation

**Statut :** accepté

**Décision.** Moteur de production en TypeScript. Python (NumPy/SciPy) sert de référence : `notebooks/export_golden.py` génère `tests/golden/*.json` comparés au moteur TS (erreur relative < 0,5 %). Rust → WASM reste une extension.
