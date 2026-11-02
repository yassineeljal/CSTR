'use client';

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

/** Bouton à deux/trois états (Manuel/Auto…) — `radiogroup` accessible, navigation aux flèches. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="border-line inline-flex overflow-hidden rounded border"
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = options.findIndex((o) => o.value === value);
        const next =
          options[(i + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length];
        if (next) onChange(next.value);
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`focus-visible:outline-accent px-3 py-1 font-mono text-xs font-medium focus-visible:outline focus-visible:outline-2 disabled:opacity-40 ${active ? 'bg-accent/20 text-accent' : 'bg-panel-2 text-muted hover:text-zinc-200'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
