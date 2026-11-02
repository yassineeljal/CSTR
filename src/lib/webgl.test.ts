import { beforeEach, describe, expect, it } from 'vitest';
import { detectWebGL, resetWebGLDetection } from './webgl';

const docWith = (getContext: (id: string) => unknown) =>
  ({ createElement: () => ({ getContext }) }) as unknown as Pick<Document, 'createElement'>;

describe('detectWebGL', () => {
  beforeEach(() => resetWebGLDetection());

  it('disponible si un contexte WebGL2 se crée', () => {
    expect(
      detectWebGL(docWith((id) => (id === 'webgl2' ? { getExtension: () => null } : null))),
    ).toBe('available');
  });
  it('se rabat sur WebGL1', () => {
    expect(
      detectWebGL(docWith((id) => (id === 'webgl' ? { getExtension: () => null } : null))),
    ).toBe('available');
  });
  it('indisponible si aucun contexte ne se crée', () => {
    expect(detectWebGL(docWith(() => null))).toBe('unavailable');
  });
  it('indisponible si la création lève une exception', () => {
    expect(
      detectWebGL(
        docWith(() => {
          throw new Error('blocked');
        }),
      ),
    ).toBe('unavailable');
  });
  it('côté serveur (pas de document) : indisponible', () => {
    expect(detectWebGL(null)).toBe('unavailable');
  });
  it('met le résultat en cache', () => {
    let calls = 0;
    const doc = docWith(() => {
      calls++;
      return { getExtension: () => null };
    });
    detectWebGL(doc);
    detectWebGL(doc);
    expect(calls).toBe(1);
  });
});
