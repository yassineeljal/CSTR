/** Fiche théorique du mode Inspection (S6-C01). Corps en Markdown + mathématiques LaTeX (`$…$`, `$$…$$`). */
export interface Sheet {
  id: SheetId;
  title: string;
  /** Une phrase affichée dans la liste. */
  summary: string;
  body: string;
}

export type SheetId =
  'bilans' | 'arrhenius' | 'van-heerden' | 'damkohler' | 'stabilite' | 'pid' | 'securite';
