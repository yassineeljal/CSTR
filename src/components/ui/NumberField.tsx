'use client';

import { useId, useState } from 'react';

interface NumberFieldProps {
  label: string;
  unit: string;
  /** Valeur en unités d'affichage. */
  value: number;
  min: number;
  max: number;
  step: number;
  /** Nombre de décimales affichées. */
  decimals?: number;
  /** Appelé avec la valeur validée (bornée) en unités d'affichage. */
  onCommit: (value: number) => void;
  disabled?: boolean;
  /** Masque le curseur (champ seul). */
  hideSlider?: boolean;
  hint?: string;
}

/** Interprète une saisie (virgule ou point décimal). Retourne `null` si invalide. */
export function parseNumberInput(text: string): number | null {
  const cleaned = text.trim().replace(/\s+/g, '').replace(',', '.');
  if (cleaned === '' || !/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export const clampTo = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

/**
 * Champ numérique + curseur synchronisés : unité affichée, bornes, saisie au clavier avec
 * validation (Entrée/blur valident, Échap annule), commande transmise immédiatement au curseur.
 */
export function NumberField({
  label,
  unit,
  value,
  min,
  max,
  step,
  decimals = 1,
  onCommit,
  disabled,
  hideSlider,
  hint,
}: NumberFieldProps) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);

  const shown = editing ? text : value.toFixed(decimals);

  const commit = () => {
    const parsed = parseNumberInput(text);
    setEditing(false);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onCommit(clampTo(parsed, min, max));
  };

  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-muted font-mono text-[11px]">
          {label}
        </label>
        <span className="flex items-baseline gap-1">
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={hint ? `${id}-hint` : undefined}
            value={shown}
            onFocus={(e) => {
              setText(value.toFixed(decimals));
              setEditing(true);
              e.currentTarget.select();
            }}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => editing && commit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                setEditing(false);
                setInvalid(false);
                e.currentTarget.blur();
              }
            }}
            className={`bg-panel-2 focus-visible:outline-accent w-20 rounded border px-1.5 py-0.5 text-right font-mono text-sm text-zinc-100 tabular-nums focus-visible:outline focus-visible:outline-2 disabled:opacity-40 ${invalid ? 'border-alarm' : 'border-line'}`}
          />
          <span className="text-muted w-9 font-mono text-[11px]">{unit}</span>
        </span>
      </div>
      {!hideSlider && (
        <input
          type="range"
          aria-label={`${label} (curseur)`}
          min={min}
          max={max}
          step={step}
          value={clampTo(value, min, max)}
          disabled={disabled}
          onChange={(e) => onCommit(Number(e.target.value))}
          className="accent-accent mt-1 h-1.5 w-full cursor-pointer disabled:opacity-40"
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-muted mt-0.5 font-mono text-[10px]">
          {hint}
        </p>
      )}
      {invalid && (
        <p role="alert" className="text-alarm mt-0.5 font-mono text-[10px]">
          Valeur invalide (nombre attendu).
        </p>
      )}
    </div>
  );
}
