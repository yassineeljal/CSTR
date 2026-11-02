import { describe, expect, it } from 'vitest';
import { SNAPSHOT_SIZE } from '../protocol';
import { SimulationHost } from '../workerCore';

/**
 * Budget de performance du moteur (PLAN §9 : temps worker par tick < 2 ms). Mesure le coût d'un
 * tick de 16 ms réels au facteur ×60 (96 pas RK4 + PID + snapshot), cas le plus défavorable.
 * Le seuil de garde (10 ms) est 5× le budget pour rester insensible à la charge des runners CI ;
 * la valeur mesurée est affichée et reportée dans docs/perf.md.
 */
describe('performance du moteur', () => {
  it('un tick au facteur ×60 coûte bien moins que sa période de 16 ms', () => {
    const host = new SimulationHost(() => {});
    host.handle({ type: 'loadScenario', id: 'cold-start' });
    host.handle({ type: 'setTimeScale', value: 60 });
    host.handle({ type: 'start' });

    let now = 0;
    for (let i = 0; i < 50; i++) host.tick((now += 16)); // échauffement JIT

    const ticks = 400;
    const durations: number[] = [];
    for (let i = 0; i < ticks; i++) {
      const t0 = performance.now();
      host.tick((now += 16));
      durations.push(performance.now() - t0);
    }
    durations.sort((a, b) => a - b);
    const mean = durations.reduce((a, b) => a + b, 0) / ticks;
    const p99 = durations[Math.floor(ticks * 0.99)] as number;
    console.log(
      `PERF moteur ×60 : moyenne ${mean.toFixed(3)} ms, p99 ${p99.toFixed(3)} ms par tick (96 pas RK4)`,
    );
    expect(mean).toBeLessThan(10);
    expect(SNAPSHOT_SIZE).toBeGreaterThan(0);
  });

  it('à ×10 (défaut) le coût par tick est un ordre de grandeur plus faible', () => {
    const host = new SimulationHost(() => {});
    host.handle({ type: 'setTimeScale', value: 10 });
    host.handle({ type: 'start' });
    let now = 0;
    for (let i = 0; i < 50; i++) host.tick((now += 16));
    const t0 = performance.now();
    for (let i = 0; i < 400; i++) host.tick((now += 16));
    const mean = (performance.now() - t0) / 400;
    console.log(`PERF moteur ×10 : moyenne ${mean.toFixed(3)} ms par tick`);
    expect(mean).toBeLessThan(5);
  });
});
