/**
 * Tampon de télémétrie à canaux multiples pour les graphes (PLAN §5.4 règle 3).
 *
 * Stockage linéaire préalloué ; quand la capacité est atteinte, la moitié la plus ancienne est
 * éliminée par `copyWithin` (coût amorti O(1) par point, aucune allocation). Les données restent
 * contiguës, ce qui permet de passer de simples `subarray` à uPlot.
 */
export class TelemetryBuffer {
  /** Canal 0 = temps simulé [s] ; canaux 1.. = séries. */
  private readonly channels: Float64Array[];
  private length = 0;

  /**
   * @param channelCount nombre de canaux, temps inclus
   * @param capacity nombre maximal de points conservés (≥ 2)
   */
  constructor(
    readonly channelCount: number,
    readonly capacity: number,
  ) {
    if (capacity < 2) throw new RangeError('capacity doit être ≥ 2');
    this.channels = Array.from({ length: channelCount }, () => new Float64Array(capacity));
  }

  get size(): number {
    return this.length;
  }

  /** Dernier temps enregistré, ou −∞ si vide. */
  get lastTime(): number {
    return this.length === 0
      ? Number.NEGATIVE_INFINITY
      : (this.channels[0] as Float64Array)[this.length - 1]!;
  }

  clear(): void {
    this.length = 0;
  }

  /**
   * Ajoute un point. `values[i]` alimente le canal i+1.
   * @param timeS temps simulé [s], doit être croissant
   */
  push(timeS: number, values: ArrayLike<number>): void {
    if (this.length === this.capacity) this.dropOldestHalf();
    const i = this.length++;
    (this.channels[0] as Float64Array)[i] = timeS;
    for (let c = 1; c < this.channelCount; c++) {
      (this.channels[c] as Float64Array)[i] = values[c - 1] as number;
    }
  }

  /** Vue contiguë (sans copie) d'un canal sur toute la fenêtre stockée. */
  channel(index: number): Float64Array {
    return (this.channels[index] as Float64Array).subarray(0, this.length);
  }

  /**
   * Index du premier point dont le temps est ≥ `minTimeS` (recherche dichotomique).
   */
  lowerBound(minTimeS: number): number {
    const t = this.channels[0] as Float64Array;
    let lo = 0;
    let hi = this.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((t[mid] as number) < minTimeS) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /**
   * Vue des `windowS` dernières secondes simulées pour un canal (sans copie).
   */
  window(index: number, windowS: number): Float64Array {
    const start = this.lowerBound(this.lastTime - windowS);
    return (this.channels[index] as Float64Array).subarray(start, this.length);
  }

  private dropOldestHalf(): void {
    const keepFrom = this.capacity >>> 1;
    const kept = this.capacity - keepFrom;
    for (const ch of this.channels) ch.copyWithin(0, keepFrom, this.capacity);
    this.length = kept;
  }
}
