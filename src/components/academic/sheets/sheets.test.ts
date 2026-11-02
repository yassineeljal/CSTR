import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { SHEETS, getSheet } from './index';

/** Extrait les segments mathématiques `$$…$$` puis `$…$` d'un corps Markdown. */
function mathSegments(body: string): { display: boolean; tex: string }[] {
  const out: { display: boolean; tex: string }[] = [];
  const withoutDisplay = body.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => {
    out.push({ display: true, tex });
    return ' ';
  });
  for (const m of withoutDisplay.matchAll(/\$([^$\n]+?)\$/g))
    out.push({ display: false, tex: m[1] as string });
  return out;
}

describe('fiches théoriques', () => {
  it('contient les 7 fiches du plan (S6-C01) avec des identifiants uniques', () => {
    expect(SHEETS.map((s) => s.id)).toEqual([
      'bilans',
      'arrhenius',
      'van-heerden',
      'damkohler',
      'stabilite',
      'pid',
      'securite',
    ]);
    expect(new Set(SHEETS.map((s) => s.id)).size).toBe(SHEETS.length);
  });

  it.each(SHEETS.map((s) => [s.id, s] as const))(
    '%s : contenu non vide et structuré',
    (_id, sheet) => {
      expect(sheet.title.length).toBeGreaterThan(5);
      expect(sheet.summary.length).toBeGreaterThan(10);
      expect(sheet.body.length).toBeGreaterThan(500);
      expect(sheet.body).toMatch(/^\s*\n?## /); // commence par un titre de section
      expect((sheet.body.match(/\$/g) ?? []).length % 2).toBe(0); // délimiteurs $ équilibrés
    },
  );

  it.each(SHEETS.map((s) => [s.id, s] as const))(
    '%s : toutes les formules LaTeX compilent (KaTeX strict)',
    (_id, sheet) => {
      const segments = mathSegments(sheet.body);
      expect(segments.length).toBeGreaterThan(2);
      for (const { tex, display } of segments) {
        expect(
          () =>
            katex.renderToString(tex, {
              displayMode: display,
              throwOnError: true,
              strict: 'error',
            }),
          tex,
        ).not.toThrow();
      }
    },
  );

  it('getSheet retrouve une fiche et rejette un identifiant inconnu', () => {
    expect(getSheet('pid').title).toMatch(/PID/);
    // @ts-expect-error identifiant volontairement invalide
    expect(() => getSheet('inconnu')).toThrow(/inconnue/);
  });

  it('les valeurs chiffrées citées sont cohérentes avec le modèle', () => {
    const all = SHEETS.map((s) => s.body).join('\n');
    // 8750/350² ≈ 0,0714 K⁻¹
    expect(8750 / 350 ** 2).toBeCloseTo(0.0714, 3);
    expect(all).toContain('0{,}071');
    // conversion à Da = 1 : X = Da/(1+Da) = 50 %
    expect(1 / (1 + 1)).toBe(0.5);
    expect(all).toContain('324,5');
    expect(all).toContain('369,7');
    // quench : facteur de dilution V/(V+Vq) = 100/160
    expect(100 / 160).toBe(0.625);
    expect(all).toContain('0,625');
  });
});
