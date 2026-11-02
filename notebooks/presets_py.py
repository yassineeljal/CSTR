"""Jeux de paramètres Python (miroirs des presets TypeScript `src/simulation/presets/`)."""
from __future__ import annotations

from cstr_model import R_GAS, Params

# --- Hydrolyse de l'oxyde de propylène (pseudo-ordre 1 en PO, eau en large excès) --------------
# H.S. Fogler, « Elements of Chemical Reaction Engineering », 5e éd., chap. 12 (CSTR) :
#   k = 16,96·10¹² · exp(−32 400 / (R·T)) h⁻¹  (R = 1,987 Btu/(lbmol·°R), T en °R)
#   ΔH_rx = −36 000 Btu/lbmol.   1 Btu/lbmol = 2,326 J/mol.
BTU_LBMOL_TO_J_MOL = 1055.056 / 453.59237
PO_EA_J_MOL = 32400 * BTU_LBMOL_TO_J_MOL  # 75,4 kJ/mol
PO_DH_J_MOL = -36000 * BTU_LBMOL_TO_J_MOL  # −83,7 kJ/mol
PO_K0_PER_S = 16.96e12 / 3600  # 4,71·10⁹ s⁻¹


def seborg() -> Params:
    return Params()


def propylene_oxide() -> Params:
    """Hydrolyse de l'oxyde de propylène en réacteur de 100 L refroidi (S1-C01).

    Les grandeurs du procédé (C_A,in, F, T_in, UA, T_c) sont choisies pour que le réacteur présente
    la multiplicité d'états stationnaires (3 solutions) : ce sont des hypothèses pédagogiques,
    pas des mesures. TODO(chem): valider avec un cas industriel.
    """
    return Params(
        V=100.0, F=0.5, CAin=4.0, Tin=300.0,
        k0=PO_K0_PER_S, EaR=PO_EA_J_MOL / R_GAS, dHr=PO_DH_J_MOL,
        rho=1000.0, cp=4.18, Cw=5.0e4,
        UAref=500.0, UAmin=50.0, Tc=285.0,
        Vj=5.0, Tcin=275.0, Fcmax=1.668,
    )
