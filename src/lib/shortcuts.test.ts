import { describe, expect, it } from 'vitest';
import { resolveShortcut } from './shortcuts';

describe('resolveShortcut', () => {
  it('Espace, Q, R, C, 1–4', () => {
    expect(resolveShortcut({ key: ' ' })).toEqual({ type: 'toggleRun' });
    expect(resolveShortcut({ key: 'q' })).toEqual({ type: 'armQuench' });
    expect(resolveShortcut({ key: 'Q' })).toEqual({ type: 'armQuench' });
    expect(resolveShortcut({ key: 'r' })).toEqual({ type: 'reset' });
    expect(resolveShortcut({ key: 'c' })).toEqual({ type: 'toggleCutaway' });
    expect(resolveShortcut({ key: 'i' })).toEqual({ type: 'toggleInspection' });
    expect(resolveShortcut({ key: 'I' })).toEqual({ type: 'toggleInspection' });
    expect(resolveShortcut({ key: '1' })).toEqual({ type: 'loadScenario', id: 'cold-start' });
    expect(resolveShortcut({ key: '2' })).toEqual({ type: 'loadScenario', id: 'pump-failure' });
    expect(resolveShortcut({ key: '3' })).toEqual({ type: 'loadScenario', id: 'fouling' });
    expect(resolveShortcut({ key: '4' })).toEqual({ type: 'loadScenario', id: 'emergency-quench' });
  });
  it('ignore les autres touches et les chiffres hors 1–4', () => {
    for (const key of ['5', '0', 'a', 'Enter', 'Escape', '1.5', ''])
      expect(resolveShortcut({ key })).toBeNull();
  });
  it('ignore les modificateurs (Ctrl+R = rechargement du navigateur)', () => {
    expect(resolveShortcut({ key: 'r', ctrlKey: true })).toBeNull();
    expect(resolveShortcut({ key: 'r', metaKey: true })).toBeNull();
    expect(resolveShortcut({ key: 'q', altKey: true })).toBeNull();
  });
  it('ignore la saisie dans un champ de texte, une liste ou un élément éditable', () => {
    expect(resolveShortcut({ key: 'r', targetTag: 'INPUT' })).toBeNull();
    expect(resolveShortcut({ key: '1', targetTag: 'TEXTAREA' })).toBeNull();
    expect(resolveShortcut({ key: 'q', targetTag: 'SELECT' })).toBeNull();
    expect(resolveShortcut({ key: 'r', targetTag: 'DIV', targetEditable: true })).toBeNull();
  });
  it('Espace sur un bouton focalisé : laissé au bouton (pas de double action)', () => {
    expect(resolveShortcut({ key: ' ', targetTag: 'BUTTON' })).toBeNull();
    expect(resolveShortcut({ key: 'q', targetTag: 'BUTTON' })).toEqual({ type: 'armQuench' });
  });
});
