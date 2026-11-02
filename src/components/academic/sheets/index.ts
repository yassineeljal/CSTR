import { arrheniusSheet } from './arrhenius';
import { bilansSheet } from './bilans';
import { damkohlerSheet } from './damkohler';
import { pidSheet } from './pid';
import { securiteSheet } from './securite';
import { stabiliteSheet } from './stabilite';
import type { Sheet, SheetId } from './types';
import { vanHeerdenSheet } from './vanHeerden';

export type { Sheet, SheetId } from './types';

/** Fiches dans l'ordre pédagogique. */
export const SHEETS: readonly Sheet[] = [
  bilansSheet,
  arrheniusSheet,
  vanHeerdenSheet,
  damkohlerSheet,
  stabiliteSheet,
  pidSheet,
  securiteSheet,
];

export function getSheet(id: SheetId): Sheet {
  const sheet = SHEETS.find((s) => s.id === id);
  if (!sheet) throw new Error(`Fiche inconnue : ${id}`);
  return sheet;
}
