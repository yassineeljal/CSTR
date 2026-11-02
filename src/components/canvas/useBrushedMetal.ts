import { useMemo } from 'react';
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping } from 'three';

/**
 * Texture procédurale de métal brossé (stries fines) pour `roughnessMap`/`bumpMap` : évite tout
 * téléchargement d'asset. Générée une fois sur un canvas 2D.
 */
export function createBrushedMetalTexture(size = 512): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
    // PRNG déterministe (mulberry32) : rendu identique d'une session à l'autre
    let s = 0x9e3779b9;
    const rnd = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let y = 0; y < size; y++) {
      const v = 128 + (rnd() - 0.5) * 70;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, size, 1);
    }
    // grain fin
    for (let i = 0; i < size * 40; i++) {
      const v = 128 + (rnd() - 0.5) * 40;
      ctx.fillStyle = `rgba(${v},${v},${v},0.25)`;
      ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 18, 1);
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(6, 3);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  return tex;
}

export function useBrushedMetalTexture(): CanvasTexture {
  return useMemo(() => createBrushedMetalTexture(), []);
}
