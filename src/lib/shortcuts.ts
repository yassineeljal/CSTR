import { SCENARIO_IDS } from '@/simulation/scenarios';
import type { ScenarioId } from '@/simulation/types';

/** Actions déclenchables au clavier (S5-L10). */
export type ShortcutAction =
  | { type: 'toggleRun' }
  | { type: 'armQuench' }
  | { type: 'reset' }
  | { type: 'loadScenario'; id: ScenarioId }
  | { type: 'toggleCutaway' }
  | { type: 'toggleInspection' };

export interface KeyInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** `tagName` de l'élément focalisé (saisie de texte : raccourcis ignorés). */
  targetTag?: string;
  /** L'élément focalisé est éditable (`contenteditable`). */
  targetEditable?: boolean;
}

const TEXT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Traduit une touche en action. Retourne `null` si la touche n'est pas un raccourci, si un
 * modificateur est pressé (Ctrl/Cmd/Alt : réservés au navigateur) ou si la saisie est en cours
 * dans un champ de texte.
 *
 * Espace : n'est pas pris quand un bouton a le focus (il l'actionnerait déjà) → `targetTag === 'BUTTON'`.
 */
export function resolveShortcut(e: KeyInput): ShortcutAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.targetEditable || (e.targetTag && TEXT_TAGS.has(e.targetTag))) return null;
  switch (e.key) {
    case ' ':
    case 'Spacebar':
      return e.targetTag === 'BUTTON' ? null : { type: 'toggleRun' };
    case 'q':
    case 'Q':
      return { type: 'armQuench' };
    case 'r':
    case 'R':
      return { type: 'reset' };
    case 'c':
    case 'C':
      return { type: 'toggleCutaway' };
    case 'i':
    case 'I':
      return { type: 'toggleInspection' };
    default: {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= SCENARIO_IDS.length) {
        return { type: 'loadScenario', id: SCENARIO_IDS[n - 1] as ScenarioId };
      }
      return null;
    }
  }
}

/** Libellés d'aide (affichés dans le panneau). */
export const SHORTCUT_HELP: readonly { keys: string; label: string }[] = [
  { keys: 'Espace', label: 'Démarrer / mettre en pause' },
  { keys: 'Q', label: 'Armer le quench (puis cliquer sur le bouton rouge)' },
  { keys: 'R', label: 'Réinitialiser' },
  { keys: 'C', label: 'Vue en coupe / complète' },
  { keys: 'I', label: 'Mode inspection (formules et valeurs)' },
  { keys: '1 – 4', label: 'Charger un scénario' },
];
