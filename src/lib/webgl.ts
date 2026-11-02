/**
 * Détection de WebGL (S7-L05). Résultat mis en cache : la création d'un contexte est coûteuse et
 * les navigateurs plafonnent leur nombre.
 */
export type WebGLSupport = 'available' | 'unavailable';

let cached: WebGLSupport | null = null;

/** Teste la création d'un contexte WebGL (2 puis 1). Côté serveur : retourne « unavailable ». */
export function detectWebGL(
  doc: Pick<Document, 'createElement'> | null = typeof document === 'undefined' ? null : document,
): WebGLSupport {
  if (cached) return cached;
  if (!doc) return 'unavailable';
  try {
    const canvas = doc.createElement('canvas') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const ok = !!gl;
    // libère immédiatement le contexte de test
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
    cached = ok ? 'available' : 'unavailable';
  } catch {
    cached = 'unavailable';
  }
  return cached;
}

/** Réinitialise le cache (tests). */
export function resetWebGLDetection(): void {
  cached = null;
}
