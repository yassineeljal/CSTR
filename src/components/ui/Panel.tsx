import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  children: ReactNode;
  /** Élément à droite du titre (badge, bouton…). */
  action?: ReactNode;
  className?: string;
  id?: string;
}

/** Cadre de panneau SCADA : titre en petites capitales, fond neutre, bordure fine. */
export function Panel({ title, children, action, className = '', id }: PanelProps) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={`border-line bg-panel/95 rounded border backdrop-blur ${className}`}
    >
      <header className="border-line flex items-center justify-between border-b px-3 py-1.5">
        <h2
          id={id ? `${id}-title` : undefined}
          className="text-muted font-mono text-[11px] font-semibold tracking-widest uppercase"
        >
          {title}
        </h2>
        {action}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}
