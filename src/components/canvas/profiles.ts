import { Shape, Vector2 } from 'three';
import { ellipticalHeadProfile, type ReactorGeometry } from '@/simulation/geometry';

/**
 * Profils de révolution (r, y) et coupes transversales des parois. Fonctions pures, sans WebGL :
 * testables sous Node. Repère : axe Y, origine au bas de la virole.
 */

export const HEAD_SEGMENTS = 40;

const v = (r: number, y: number): Vector2 => new Vector2(r, y);

/** Fond bas elliptique 2:1 : du pôle au raccord avec la virole (y = 0). */
function bottomHead(radius: number, depth: number, segments = HEAD_SEGMENTS): Vector2[] {
  return ellipticalHeadProfile(radius, depth, segments).map(([r, y]) => v(r, y));
}

/** Couvercle elliptique : du raccord (y = H) au pôle (y = H + depth). */
function topHead(radius: number, depth: number, H: number, segments = HEAD_SEGMENTS): Vector2[] {
  const pts: Vector2[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * (Math.PI / 2); // 0 = bord, π/2 = pôle
    pts.push(v(radius * Math.cos(a), H + depth * Math.sin(a)));
  }
  return pts;
}

/** Surface extérieure de la cuve : pôle du fond → bord du fond → haut de la virole. */
export function vesselOuterProfile(g: ReactorGeometry): Vector2[] {
  const ro = g.tankRadius + g.wallThickness;
  return [...bottomHead(ro, g.headDepth + g.wallThickness), v(ro, g.shellHeight)];
}

/** Surface intérieure de la cuve (celle qui touche le fluide). */
export function vesselInnerProfile(g: ReactorGeometry): Vector2[] {
  return [...bottomHead(g.tankRadius, g.headDepth), v(g.tankRadius, g.shellHeight)];
}

export function lidOuterProfile(g: ReactorGeometry): Vector2[] {
  return topHead(g.tankRadius + g.wallThickness, g.headDepth + g.wallThickness, g.shellHeight);
}

export function lidInnerProfile(g: ReactorGeometry): Vector2[] {
  return topHead(g.tankRadius, g.headDepth, g.shellHeight);
}

function closed(points: Vector2[]): Shape {
  const s = new Shape();
  const first = points[0] as Vector2;
  s.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++)
    s.lineTo((points[i] as Vector2).x, (points[i] as Vector2).y);
  s.closePath();
  return s;
}

/** Coupe de la paroi de cuve (fond + virole) : bande entre profils extérieur et intérieur. */
export function vesselWallSection(g: ReactorGeometry): Shape {
  return closed([...vesselOuterProfile(g), ...vesselInnerProfile(g).reverse()]);
}

/** Coupe du couvercle. */
export function lidWallSection(g: ReactorGeometry): Shape {
  return closed([...lidOuterProfile(g), ...lidInnerProfile(g).reverse()]);
}

/** Rayons caractéristiques de l'enveloppe. */
export function jacketRadii(g: ReactorGeometry): {
  inner: number;
  outer: number;
  coolantOuter: number;
} {
  return {
    inner: g.tankRadius + g.wallThickness, // surface extérieure de la cuve
    outer: g.jacketOuterRadius, // surface extérieure de l'enveloppe
    coolantOuter: g.jacketOuterRadius - g.wallThickness, // surface intérieure de l'enveloppe
  };
}

/** Coupe de l'enveloppe : paroi extérieure + plaques haute et basse (hors vessel). */
export function jacketWallSections(g: ReactorGeometry): Shape[] {
  const { inner, outer, coolantOuter } = jacketRadii(g);
  const t = g.wallThickness;
  const rect = (r0: number, r1: number, y0: number, y1: number) =>
    closed([v(r0, y0), v(r1, y0), v(r1, y1), v(r0, y1)]);
  return [
    rect(coolantOuter, outer, g.jacketBottom - t, g.jacketTop + t), // paroi extérieure
    rect(inner, outer, g.jacketBottom - t, g.jacketBottom), // plaque basse
    rect(inner, outer, g.jacketTop, g.jacketTop + t), // plaque haute
  ];
}

/** Coupe du volume de fluide caloporteur dans l'enveloppe. */
export function jacketCoolantSection(g: ReactorGeometry): Shape {
  const { inner, coolantOuter } = jacketRadii(g);
  return closed([
    v(inner, g.jacketBottom),
    v(coolantOuter, g.jacketBottom),
    v(coolantOuter, g.jacketTop),
    v(inner, g.jacketTop),
  ]);
}

/**
 * Profil de révolution du fluide réactionnel (fermé sur l'axe) : pôle → bord du fond → paroi →
 * surface libre jusqu'à l'axe. La surface libre est subdivisée radialement pour le vortex (S4-L02).
 */
export function fluidProfile(g: ReactorGeometry, surfaceSegments = 24): Vector2[] {
  const pts = [...bottomHead(g.tankRadius, g.headDepth), v(g.tankRadius, g.liquidHeight)];
  for (let i = 1; i <= surfaceSegments; i++) {
    pts.push(v(g.tankRadius * (1 - i / surfaceSegments), g.liquidHeight));
  }
  return pts;
}

/** Coupe du fluide réactionnel. */
export function fluidSection(g: ReactorGeometry): Shape {
  return closed([
    ...bottomHead(g.tankRadius, g.headDepth),
    v(g.tankRadius, g.liquidHeight),
    v(0, g.liquidHeight),
  ]);
}

/** Aire (signée → absolue) d'un polygone fermé : formule du lacet. */
export function polygonArea(points: ReadonlyArray<{ x: number; y: number }>): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i] as { x: number; y: number };
    const q = points[(i + 1) % points.length] as { x: number; y: number };
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** Volume de révolution d'une coupe (théorème de Pappus) : V = 2π·r̄·A. */
export function revolvedVolume(shape: Shape): number {
  const pts = shape.getPoints(1);
  let area = 0;
  let cx = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i] as Vector2;
    const q = pts[(i + 1) % pts.length] as Vector2;
    const cross = p.x * q.y - q.x * p.y;
    area += cross;
    cx += (p.x + q.x) * cross;
  }
  area /= 2;
  const centroidX = cx / (6 * area);
  return 2 * Math.PI * Math.abs(centroidX * area);
}
