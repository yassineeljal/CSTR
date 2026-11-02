/** Fonction dérivée : écrit f(x, t) dans `out`. Doit être sans allocation. */
export type DerivativeFn = (x: Float64Array, t: number, out: Float64Array) => void;

/**
 * Intégrateur Runge-Kutta d'ordre 4 à pas fixe, générique, sans allocation par pas :
 * les tampons k1..k4 et l'état intermédiaire sont préalloués.
 */
export class Rk4Integrator {
  private readonly k1: Float64Array;
  private readonly k2: Float64Array;
  private readonly k3: Float64Array;
  private readonly k4: Float64Array;
  private readonly tmp: Float64Array;

  constructor(
    readonly size: number,
    private readonly f: DerivativeFn,
  ) {
    this.k1 = new Float64Array(size);
    this.k2 = new Float64Array(size);
    this.k3 = new Float64Array(size);
    this.k4 = new Float64Array(size);
    this.tmp = new Float64Array(size);
  }

  /**
   * Avance l'état `x` (modifié en place) de t à t + h.
   * @param x état (longueur `size`)
   * @param t temps courant [s]
   * @param h pas [s]
   */
  step(x: Float64Array, t: number, h: number): void {
    const { k1, k2, k3, k4, tmp, f, size: n } = this;
    const h2 = h / 2;

    f(x, t, k1);
    for (let i = 0; i < n; i++) tmp[i] = (x[i] as number) + h2 * (k1[i] as number);
    f(tmp, t + h2, k2);
    for (let i = 0; i < n; i++) tmp[i] = (x[i] as number) + h2 * (k2[i] as number);
    f(tmp, t + h2, k3);
    for (let i = 0; i < n; i++) tmp[i] = (x[i] as number) + h * (k3[i] as number);
    f(tmp, t + h, k4);
    for (let i = 0; i < n; i++) {
      x[i] =
        (x[i] as number) +
        (h / 6) *
          ((k1[i] as number) + 2 * (k2[i] as number) + 2 * (k3[i] as number) + (k4[i] as number));
    }
  }
}
